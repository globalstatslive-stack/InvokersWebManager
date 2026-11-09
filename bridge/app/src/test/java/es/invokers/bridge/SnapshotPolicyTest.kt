package es.invokers.bridge
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
class SnapshotPolicyTest {
    @Test fun acceptsSnapshotName() { assertEquals("PlayerHeroesModel.dat", SnapshotPolicy.validate("PlayerHeroesModel.dat")) }
    @Test fun rejectsTraversalAndNonDat() {
        for (name in listOf("../secret.dat", "/tmp/x.dat", "..\\secret.dat", "other.json", ".dat")) {
            assertThrows(IllegalArgumentException::class.java) { SnapshotPolicy.validate(name) }
        }
    }
}
