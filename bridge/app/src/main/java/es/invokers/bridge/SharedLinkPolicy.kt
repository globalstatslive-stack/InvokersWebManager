package es.invokers.bridge

import java.net.URI
import java.util.Locale

/** Acepta únicamente el enlace de lectura compartida que publica el portal oficial. */
object SharedLinkPolicy {
    const val MAX_BYTES = 20L * 1024 * 1024
    private val query = Regex("b=([A-Za-z0-9-]{1,80})")

    fun token(text: String): String {
        val uri = try { URI(text.trim()) } catch (_: Exception) { throw invalidLink() }
        val host = uri.host?.lowercase(Locale.ROOT)
        if (!uri.scheme.equals("https", true) || host !in setOf("invokers.com", "www.invokers.com") ||
            uri.rawUserInfo != null || uri.port != -1 || uri.rawFragment != null ||
            uri.rawPath !in setOf("/lamb/", "/lamb")) throw invalidLink()
        val match = query.matchEntire(uri.rawQuery ?: "") ?: throw invalidLink()
        return match.groupValues[1].lowercase(Locale.ROOT)
    }

    fun apiUrl(link: String): String = "https://invokers.com/api/lamb/${token(link)}"

    private fun invalidLink() = IllegalArgumentException("Pega un enlace oficial completo: https://invokers.com/lamb/?b=…")
}
