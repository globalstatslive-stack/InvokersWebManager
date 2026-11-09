package es.invokers.bridge

import android.app.Activity
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.IBinder
import android.os.ParcelFileDescriptor
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.FileProvider
import rikka.shizuku.Shizuku
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** Lee solo los snapshots mediante el UserService oficial de Shizuku. */
class MainActivity : Activity() {
    private lateinit var status: TextView
    private var connecting = false
    private val requestCode = 100
    private val permissionResult = Shizuku.OnRequestPermissionResultListener { code, result ->
        if (code == requestCode) {
            if (result == PackageManager.PERMISSION_GRANTED) bindReader()
            else show("Permiso denegado. Autoriza Invokers Bridge en Shizuku.")
        }
    }
    private val binderReady = Shizuku.OnBinderReceivedListener { refresh() }
    private val binderDead = Shizuku.OnBinderDeadListener { show("Shizuku se ha detenido. Inícialo de nuevo desde depuración inalámbrica.") }
    private val args by lazy { Shizuku.UserServiceArgs(ComponentName(packageName, SnapshotReaderService::class.java.name)).daemon(false).processNameSuffix("reader").debuggable(BuildConfig.DEBUG).version(BuildConfig.VERSION_CODE) }
    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            if (!binder.pingBinder()) { connecting = false; show("El lector de Shizuku no responde."); return }
            show("Leyendo archivos sin modificar el juego…")
            Thread {
                try { readAndShare(IReader.Stub.asInterface(binder)) }
                catch (e: Exception) { show("Error al leer: ${e.message ?: e.javaClass.simpleName}") }
                finally { connecting = false }
            }.start()
        }
        override fun onServiceDisconnected(name: ComponentName) { connecting = false; show("Se perdió la conexión con Shizuku.") }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (24 * resources.displayMetrics.density).toInt()
        val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad * 2, pad, pad); setBackgroundColor(0xff101827.toInt()) }
        fun add(message: String, size: Float, color: Int): TextView = TextView(this).apply {
            text = message; textSize = size; setTextColor(color)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = pad }
            column.addView(this)
        }
        add("INVOKERS BRIDGE", 14f, 0xffe8bd73.toInt())
        add("Snapshots directos desde Android", 28f, -1)
        add("Puente de solo lectura. Necesita Shizuku activo y tu autorización. No solicita contraseña ni modifica el juego.", 16f, 0xffc2cedb.toInt())
        status = add("Comprobando Shizuku…", 15f, 0xffe8bd73.toInt())
        column.addView(Button(this).apply { text = "LEER Y COMPARTIR SNAPSHOTS"; setOnClickListener { begin() } })
        column.addView(Button(this).apply { text = "CAMBIAR DESTINO DE COMPARTIR"; setOnClickListener {
            getSharedPreferences("share-target", MODE_PRIVATE).edit().remove("component").apply()
            show("Destino olvidado. En la próxima lectura podrás elegir la PWA en Compartir.")
        } })
        column.addView(Button(this).apply { text = "BORRAR COPIAS TEMPORALES"; setOnClickListener {
            if (connecting) show("Espera a que termine la lectura antes de borrar las copias.")
            else { File(cacheDir, "shares").deleteRecursively(); show("Copias temporales del puente borradas.") }
        } })
        add("La primera vez, selecciona Invokers Web Manager en Compartir. La web guardará los archivos automáticamente. Si Android lo permite, el puente recordará tu elección para la próxima lectura.", 14f, 0xffa3b3c4.toInt())
        add("Tras reiniciar el teléfono, Shizuku puede necesitar que actives otra vez la depuración inalámbrica.", 14f, 0xffa3b3c4.toInt())
        setContentView(ScrollView(this).apply { addView(column); isFillViewport = true })
        Shizuku.addBinderReceivedListenerSticky(binderReady)
        Shizuku.addBinderDeadListener(binderDead)
        Shizuku.addRequestPermissionResultListener(permissionResult)
        refresh()
    }
    private fun show(message: String) = runOnUiThread { if (::status.isInitialized) status.text = message }
    private fun refresh() { show(if (runCatching { Shizuku.pingBinder() }.getOrDefault(false)) "Shizuku activo. Listo para leer los .dat." else "Inicia Shizuku con depuración inalámbrica antes de continuar.") }
    private fun begin() {
        if (connecting) return
        if (!runCatching { Shizuku.pingBinder() }.getOrDefault(false)) { refresh(); return }
        when {
            Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED -> bindReader()
            Shizuku.shouldShowRequestPermissionRationale() -> show("Autoriza el puente desde Shizuku.")
            else -> { show("Esperando autorización de Shizuku…"); Shizuku.requestPermission(requestCode) }
        }
    }
    private fun bindReader() {
        if (connecting) return
        connecting = true; show("Conectando con Shizuku…")
        try { Shizuku.bindUserService(args, connection) }
        catch (e: Exception) { connecting = false; show("No se pudo conectar: ${e.message}") }
    }
    private fun readAndShare(reader: IReader) {
        val names = reader.listSnapshots()
        require(names.isNotEmpty() && names.size <= 100) { "No se encontraron .dat válidos o hay demasiados archivos" }
        val directory = File(cacheDir, "shares/${UUID.randomUUID()}").apply { mkdirs() }
        val uris = ArrayList<android.net.Uri>()
        var batchBytes = 0L
        for (name in names) {
            SnapshotPolicy.validate(name)
            val destination = File(directory, name)
            val temp = File(directory, "$name.tmp")
            var fileBytes = 0L
            reader.openSnapshot(name).use { fd ->
                ParcelFileDescriptor.AutoCloseInputStream(fd).use { input ->
                    FileOutputStream(temp).use { output ->
                        val buffer = ByteArray(32 * 1024)
                        while (true) {
                            val n = input.read(buffer)
                            if (n < 0) break
                            fileBytes += n; batchBytes += n
                            require(fileBytes <= SnapshotPolicy.MAX_FILE_BYTES && batchBytes <= SnapshotPolicy.MAX_BATCH_BYTES) { "Límite de lectura superado" }
                            output.write(buffer, 0, n)
                        }
                    }
                }
            }
            require(temp.renameTo(destination)) { "No se pudo preparar $name" }
            uris.add(FileProvider.getUriForFile(this, "$packageName.files", destination))
        }
        runOnUiThread {
            val send = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
                type = "application/octet-stream"
                putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                clipData = ClipData.newUri(contentResolver, "Snapshots de Invokers", uris.first()).also { clip -> uris.drop(1).forEach { clip.addItem(ClipData.Item(it)) } }
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val saved = getSharedPreferences("share-target", MODE_PRIVATE).getString("component", null)
                ?.let(ComponentName::unflattenFromString)
            if (saved != null && isInvokersWebApk(this, saved.packageName)) {
                try {
                    startActivity(Intent(send).setComponent(saved))
                    show("${uris.size} archivos leídos. Abriendo Invokers Web Manager para guardarlos…")
                    return@runOnUiThread
                } catch (_: ActivityNotFoundException) {
                    getSharedPreferences("share-target", MODE_PRIVATE).edit().remove("component").apply()
                } catch (_: SecurityException) {
                    getSharedPreferences("share-target", MODE_PRIVATE).edit().remove("component").apply()
                }
            }
            val callback = PendingIntent.getBroadcast(
                this, 0, Intent(this, ShareTargetReceiver::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )
            show("${uris.size} archivos leídos. Elige Invokers Web Manager en Compartir; la web los guardará automáticamente.")
            startActivity(Intent.createChooser(send, "Compartir con Invokers Web Manager", callback.intentSender))
        }
    }
    override fun onDestroy() {
        Shizuku.removeBinderReceivedListener(binderReady)
        Shizuku.removeBinderDeadListener(binderDead)
        Shizuku.removeRequestPermissionResultListener(permissionResult)
        super.onDestroy()
    }
}
