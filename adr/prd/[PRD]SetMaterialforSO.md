## Requirements

### Melakukan set wajib SO ketika buat material di Material Setting Global

Scenario: User mengatur material sebagai Wajib SO saat membuat material baru
Given pengguna mengakses halaman pembuatan material di Material Setting Global
When pengguna mengisi data material dan mencentang opsi "Wajib SO"
And klik tombol Simpan
Then material tersimpan dengan status Wajib SO = "Ya"

### Melakukan set wajib SO ketika edit material di Material Setting Global

Scenario: User mengubah status Wajib SO untuk material yang sudah ada
Given pengguna membuka halaman edit material di Material Setting Global
When pengguna mengubah status "Wajib SO" menjadi "Ya" atau "Tidak"
And klik tombol Simpan
Then perubahan status Wajib SO tersimpan sesuai pengaturan terakhir

Scenario: User melihat response error jika material tersebut sudah di SO-kan
Given pengguna sudah mensubmit edit SO dengan value yang berbeda dari sebelumnya
When Value Status Wajib SO yang berbeda dari sebelumnya
Then terdapat respon validasi jika material tersebut sudah pernah dilakukan SO

### Melihat data keterangan Wajib SO di detail material di Setting Global

Scenario: User melihat detail material di Material Setting Global
Given pengguna membuka halaman detail material
Then sistem menampilkan informasi apakah material bersifat Wajib SO atau tidak

### Melihat data keterangan Wajib SO di detail material di Setting Program

Scenario: User melihat status Wajib SO dari material pada Setting Program
Given pengguna membuka detail material di Setting Program
Then sistem menampilkan status Wajib SO berdasarkan pengaturan dari Material Setting Global

### Melihat data keterangan Wajib SO ketika export di Setting Global

Scenario: User mengekspor daftar material dari Material Setting Global
Given pengguna menekan tombol Export pada halaman Material Setting Global
Then file hasil export mencakup kolom "Wajib SO"
And nilai pada kolom tersebut menunjukkan "Ya" atau "Tidak" sesuai status tiap material
