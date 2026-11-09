package es.invokers.bridge

import android.os.ParcelFileDescriptor
import es.invokers.bridge.IReader
import java.io.File
import java.io.FileNotFoundException

/** Runs under Shizuku's shell identity. The fixed source is read-only. */
class SnapshotReaderService : IReader.Stub() {
    private val directory = File(SnapshotPolicy.SOURCE)
    override fun listSnapshots(): Array<String> {
        val files = directory.listFiles() ?: throw FileNotFoundException("No se puede leer aggregate_snapshots con los permisos actuales")
        return files.filter { it.isFile && runCatching { SnapshotPolicy.validate(it.name) }.isSuccess }
            .map { it.name }.sorted().toTypedArray()
    }
    override fun openSnapshot(name: String): ParcelFileDescriptor {
        SnapshotPolicy.validate(name)
        val file = File(directory, name).canonicalFile
        if (file.parentFile != directory.canonicalFile || !file.isFile || file.length() > SnapshotPolicy.MAX_FILE_BYTES) {
            throw FileNotFoundException("Archivo no válido o demasiado grande")
        }
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
    }
    override fun destroy() { System.exit(0) }
}
