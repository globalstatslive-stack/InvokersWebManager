package es.invokers.bridge

object SnapshotPolicy {
    const val SOURCE = "/storage/emulated/0/Android/data/hitzone.anima.spirit.guardians/files/aggregate_snapshots"
    const val MAX_FILE_BYTES = 100L * 1024 * 1024
    const val MAX_BATCH_BYTES = 250L * 1024 * 1024
    private val valid = Regex("[A-Za-z0-9._-]{1,120}\\.dat", RegexOption.IGNORE_CASE)
    fun validate(name: String): String {
        require(valid.matches(name) && name != ".dat") { "Nombre de archivo no válido" }
        return name
    }
}
