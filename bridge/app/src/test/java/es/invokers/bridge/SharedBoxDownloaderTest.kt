package es.invokers.bridge

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import org.junit.Assert.*
import org.junit.Test

class SharedBoxDownloaderTest {
    private val link = "https://invokers.com/lamb/?b=test-public-link"
    private class Response(url: URL, private val status: Int = 200, private val body: String = "{\"heroes\":[]}", private val mime: String = "application/json; charset=utf-8", private val length: Long = -1) : HttpURLConnection(url) {
        var disconnected = false
        override fun getResponseCode() = status
        override fun getContentType() = mime
        override fun getContentLengthLong() = length
        override fun getInputStream() = ByteArrayInputStream(body.toByteArray())
        override fun connect() = Unit
        override fun disconnect() { disconnected = true }
        override fun usingProxy() = false
    }

    @Test fun downloadsFromFixedOriginWithoutCredentialsAndNeverFollowsRedirects() {
        var response: Response? = null
        val downloader = SharedBoxDownloader { url -> Response(url).also { response = it } }
        val out = ByteArrayOutputStream()
        downloader.download(link, out)
        val connection = response!!
        assertEquals("https://invokers.com/api/lamb/test-public-link", connection.url.toString())
        assertEquals("GET", connection.requestMethod)
        assertFalse(connection.instanceFollowRedirects)
        assertEquals(20_000, connection.connectTimeout)
        assertEquals(20_000, connection.readTimeout)
        assertNull(connection.getRequestProperty("Cookie"))
        assertNull(connection.getRequestProperty("Authorization"))
        assertEquals("{\"heroes\":[]}", out.toString("UTF-8"))
        assertTrue(connection.disconnected)
    }

    @Test fun reportsExpiredLinksAndRejectsRedirects() {
        for (status in listOf(301,302,307,308,404,401,403,429,500)) {
            val out = ByteArrayOutputStream()
            val error = assertThrows(SharedBoxException::class.java) { SharedBoxDownloader { Response(it,status) }.download(link,out) }
            if(status==404) assertTrue(error.message!!.contains("caducado"))
            assertFalse(error.message!!.contains("test-public-link"))
            assertEquals(0,out.size())
        }
    }

    @Test fun refusesOversizedAndNonJsonBodies() {
        assertThrows(SharedBoxException::class.java) { SharedBoxDownloader { Response(it,length=SharedLinkPolicy.MAX_BYTES+1) }.download(link,ByteArrayOutputStream()) }
        assertThrows(SharedBoxException::class.java) { SharedBoxDownloader { Response(it,mime="text/html") }.download(link,ByteArrayOutputStream()) }
        for (body in listOf("<html>error</html>", "   ", "[]")) assertThrows(SharedBoxException::class.java) { SharedBoxDownloader { Response(it,body=body) }.download(link,ByteArrayOutputStream()) }
        assertThrows(SharedBoxException::class.java) { SharedBoxDownloader.copyJson(ByteArrayInputStream("{\"large\":123}".toByteArray()),ByteArrayOutputStream(),5) }
    }
}
