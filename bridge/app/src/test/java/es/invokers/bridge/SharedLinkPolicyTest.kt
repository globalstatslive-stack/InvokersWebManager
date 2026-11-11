package es.invokers.bridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SharedLinkPolicyTest {
    @Test fun acceptsOnlyOfficialSharedLinks() {
        assertEquals("abc-123", SharedLinkPolicy.token(" https://invokers.com/lamb/?b=AbC-123 "))
        assertEquals("abc-123", SharedLinkPolicy.token("https://www.invokers.com/lamb?b=abc-123"))
        assertEquals("https://invokers.com/api/lamb/abc-123", SharedLinkPolicy.apiUrl("https://www.invokers.com/lamb/?b=abc-123"))
    }

    @Test fun rejectsOtherOriginsQueriesAndAmbiguousLinks() {
        val invalid = listOf(
            "http://invokers.com/lamb/?b=abc", "https://invokers.com.evil.test/lamb/?b=abc",
            "https://invokers.com@evil.test/lamb/?b=abc", "https://name@invokers.com/lamb/?b=abc",
            "https://invokers.com:443/lamb/?b=abc", "https://invokers.com/lamb/?b=abc#fragment",
            "https://invokers.com/lamb/?b=abc&b=def", "https://invokers.com/lamb/?b=abc&redirect=evil",
            "https://invokers.com/lamb/?b=abc/def", "https://invokers.com/lamb/?b=abc%2fdef",
            "https://invokers.com/api/box", "https://invokers.com/lamb/?b=", "https://invokers.com/lamb/",
            "https://invokers.com/lamb/?b=${"a".repeat(81)}", "https://invokers.com/%6camb/?b=abc"
        )
        for (link in invalid) assertThrows(link, IllegalArgumentException::class.java) { SharedLinkPolicy.token(link) }
    }
}
