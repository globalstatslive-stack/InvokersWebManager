package es.invokers.bridge

import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL

class SharedBoxException(message: String) : IOException(message)

/** Solo GET al dominio oficial, sin cookies, sesiones ni redirecciones. */
class SharedBoxDownloader(private val connect: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection }) {
    fun download(link: String, output: OutputStream): Long {
        val url = URL(SharedLinkPolicy.apiUrl(link))
        val connection = connect(url)
        try {
            connection.instanceFollowRedirects = false
            connection.requestMethod = "GET"
            connection.connectTimeout = 20_000
            connection.readTimeout = 20_000
            connection.useCaches = false
            connection.setRequestProperty("Accept", "application/json")
            when (connection.responseCode) {
                200 -> Unit
                404 -> throw SharedBoxException("El enlace ha caducado o la colección ya no es pública. Genera un enlace nuevo en el portal oficial.")
                401, 403 -> throw SharedBoxException("El portal no permite leer este enlace. Comprueba que el enlace compartido siga activo.")
                in 300..399 -> throw SharedBoxException("El portal ha redirigido la descarga. No se ha seguido la redirección; revisa el enlace oficial.")
                429 -> throw SharedBoxException("El portal ha limitado temporalmente las peticiones. Inténtalo más tarde.")
                else -> throw SharedBoxException("El portal no pudo entregar la colección. Inténtalo más tarde.")
            }
            val type = connection.contentType?.substringBefore(';')?.trim()?.lowercase()
            if (type != "application/json") throw SharedBoxException("El enlace no ha devuelto una colección JSON válida.")
            if (connection.contentLengthLong > SharedLinkPolicy.MAX_BYTES) throw SharedBoxException("La colección supera el límite de 20 MiB.")
            return connection.inputStream.use { copyJson(it, output) }
        } catch (e: SharedBoxException) {
            throw e
        } catch (_: IOException) {
            // No exponer el enlace/token en los mensajes del sistema ni registrarlo.
            throw SharedBoxException("No se pudo descargar la colección. Comprueba Internet y vuelve a intentarlo.")
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        internal fun copyJson(input: InputStream, output: OutputStream, maximum: Long = SharedLinkPolicy.MAX_BYTES): Long {
            val buffer = ByteArray(32 * 1024)
            var count = 0L
            var started = false
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                count += read
                if (count > maximum) throw SharedBoxException("La colección supera el límite de 20 MiB.")
                if (!started) for (i in 0 until read) {
                    val byte = buffer[i].toInt() and 0xff
                    if (byte in listOf(0x20, 0x09, 0x0a, 0x0d)) continue
                    if (byte != 0x7b) throw SharedBoxException("El enlace no ha devuelto una colección JSON válida.")
                    started = true
                    break
                }
                output.write(buffer, 0, read)
            }
            if (!started) throw SharedBoxException("La colección descargada está vacía.")
            // La PWA valida la estructura de cuenta y cada registro antes de importarlos.
            return count
        }
    }
}
