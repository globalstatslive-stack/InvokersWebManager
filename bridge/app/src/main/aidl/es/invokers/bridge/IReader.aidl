package es.invokers.bridge;
import android.os.ParcelFileDescriptor;
interface IReader {
    void destroy() = 16777114;
    String[] listSnapshots() = 1;
    ParcelFileDescriptor openSnapshot(String name) = 2;
}
