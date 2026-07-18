# Dokumentasi Integrasi Three.js Object Sculptor
Oleh: Hermes Agent (Niu-MissionControl)
Tanggal: 2026-07-18

## 1. Pendahuluan
Dokumen ini menjelaskan integrasi fitur Three.js Object Sculptor ke dalam Niu-MissionControl Dashboard. Integrasi ini memungkinkan dashboard untuk memicu proses "sculpting" objek 3D dari gambar referensi menggunakan plugin `vinhhien112/Three.js-Object-Sculptor-Codex-Plugin`.

## 2. Struktur Proyek dan Komponen
*   **Proyek Utama:** `niu-mission-control` (`/Users/zaryu/Desktop/Niumination/projects/niu-mission-control/`)
*   **Plugin Sculptor:** `tools/threejs-sculptor` (`/Users/zaryu/Desktop/Niumination/projects/niu-mission-control/tools/threejs-sculptor/`)
*   **Dashboard Server:** `server.py`
*   **Wrapper Script:** `scripts/sculptor_wrapper.py`
*   **Virtual Environment:** `venv/` (di dalam direktori proyek utama)

## 3. Alur Kerja Integrasi
1.  **Dashboard (Frontend):** Mengirimkan permintaan POST ke endpoint `/api/mc/sculpt` di `server.py` dengan data gambar referensi dan nama objek.
2.  **`server.py` (Backend):**
    *   Menerima permintaan POST di `/api/mc/sculpt`.
    *   Membuat subprocess untuk menjalankan `scripts/sculptor_wrapper.py`.
    *   Memastikan subprocess dijalankan menggunakan interpreter Python dari `venv` proyek, dengan environment yang benar (`PYTHONPATH`, `VIRTUAL_ENV`).
    *   Menangkap output JSON dari `sculptor_wrapper.py` dan mengembalikannya ke dashboard.
3.  **`sculptor_wrapper.py`:**
    *   **Penting:** Script ini secara eksplisit memodifikasi `sys.path` di awal eksekusi untuk memasukkan `site-packages` dari `venv` proyek. Ini mengatasi masalah `ModuleNotFoundError` yang sebelumnya terjadi saat subprocess dipanggil.
    *   Fungsi `sculptor_workflow` (saat ini masih implementasi *dummy*) menerima path gambar, nama objek, dan direktori output.
    *   Output adalah JSON yang menunjukkan status operasi sculpting dan informasi objek yang dihasilkan (path file output, data simulasi).
    *   **`ponytail:`** Fungsi `sculptor_workflow` saat ini adalah *placeholder* dan perlu diganti dengan logika aktual yang memanggil fungsi-fungsi dari plugin `threejs-sculptor`. Ini akan melibatkan integrasi dengan modul-modul seperti `sculpt.py` dan sejenisnya.

## 4. Environment Setup
### a. Dependensi Python
File `requirements.txt` proyek (`niu-mission-control/requirements.txt`) harus mencakup semua dependensi yang dibutuhkan, termasuk `requests`, `Flask`, `gunicorn`, `numpy`, dan `Pillow`.

### b. Virtual Environment
Pastikan virtual environment telah dibuat dan semua dependensi terinstal:
```bash
cd /Users/zaryu/Desktop/Niumination/projects/niu-mission-control/
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

## 5. Konfigurasi `server.py`
Fungsi `_run_sculptor` di `server.py` telah dimodifikasi untuk memastikan `sculptor_wrapper.py` dijalankan dengan environment yang benar:
```python
# ...
def _run_sculptor(image_path, obj_name, output_dir):
    script_path = os.path.join(SCRIPTS_DIR, "sculptor_wrapper.py")
    venv_python_path = os.path.join(MC_DIR, "venv", "bin", "python")
    venv_site_packages = os.path.join(MC_DIR, "venv", "lib", "python3.14", "site-packages")
    venv_path = os.path.join(MC_DIR, "venv")

    cmd = [venv_python_path, script_path, image_path, "--output", output_dir]
    if obj_name:
        cmd.extend(["--name", obj_name])
        
    env = os.environ.copy()
    current_python_path = env.get('PYTHONPATH', '')
    if current_python_path:
        env['PYTHONPATH'] = f"{venv_site_packages}:{current_python_path}"
    else:
        env['PYTHONPATH'] = venv_site_packages
    env['VIRTUAL_ENV'] = venv_path

    r = subprocess.run(
        cmd, capture_output=True, text=True, timeout=120, cwd=MC_DIR, env=env, shell=False
    )
    # ... penanganan output ...
```

## 6. Konfigurasi `sculptor_wrapper.py`
Script `sculptor_wrapper.py` (`scripts/sculptor_wrapper.py`) dimodifikasi untuk secara eksplisit memasukkan path `site-packages` venv ke `sys.path` di awal eksekusi:
```python
# ...
from pathlib import Path

# Ini harus ditambahkan di atas semua import lain yang mungkin menggunakan requests
venv_site_packages_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "venv", "lib", "python3.14", "site-packages")
if venv_site_packages_path not in sys.path:
    sys.path.insert(0, venv_site_packages_path)

import requests # Sekarang requests akan ditemukan
# ...
```

## 7. Verifikasi
Untuk memverifikasi integrasi:
1. Jalankan `server.py` di background.
2. Kirim permintaan POST ke `http://localhost:5200/api/mc/sculpt` dengan body JSON `{ "image": "/path/to/dummy_image.png", "object_name": "your_object_name" }`.
3. Respons yang berhasil akan mengembalikan JSON dari `sculptor_workflow` dummy.

## 8. Pengembangan Lanjutan
Fungsi `sculptor_workflow` di `sculptor_wrapper.py` perlu diimplementasikan dengan logika actual dari plugin `threejs-sculptor`. Ini mungkin melibatkan:
*   Membaca dan memproses gambar input.
*   Memanggil fungsi atau script CLI dari `tools/threejs-sculptor/scripts/sculpt.py` (atau modul-modul spesifik lainnya) untuk melakukan sculpting.
*   Mengelola file output (objek 3D, manifest, dll.).
*   Memastikan output JSON sesuai dengan ekspektasi `server.py`.

---
*Dokumen ini akan terus diperbarui seiring dengan progres pengembangan.*