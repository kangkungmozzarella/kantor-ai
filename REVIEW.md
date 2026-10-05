# Pemeriksaan kantor empat lantai

## Evening building overview (30 Sep 2026)

Referensi full-building bernuansa senja disetujui pengguna. Design read: gedung kantor interaktif dengan interior hangat, panel navy dan seleksi biru; ENERGY 2 / RHYTHM 2 / MOTION 2. Kamera overview diperbesar dan ditengahkan di antara panel. Cahaya lingkungan dikurangi, sumber hangat per lantai serta lampu pagar memberi pembeda interior/kota. Kabut tipis menenangkan lingkungan jauh. Mode satu lantai mempertahankan interior siang.

Thumbnail diambil dari model lantai sungguhan saat startup. Jumlah orang berasal dari roster pada lantai tersebut, mengecualikan yang sedang di tangga dan pengunjung barber. Panel gelap hanya dipakai saat overview untuk keterbacaan di atas pemandangan; tanpa menu atau statistik palsu. Ponsel menampilkan angka dan label ringkas menggantikan thumbnail.

Gate perubahan:
- R-23/R-37 PASS: referensi dan arah visual disetujui; preview berasal dari scene sendiri.
- R-17/C-5 PASS: angka bukan status online, dihitung dari state simulasi; tes memeriksa 13 anggota di lantai kerja saat awal.
- R-26/R-35 PASS: tes member-commands lulus untuk perintah, rapat, kamera tetap serta tugas; building-view memeriksa thumbnail, klik lantai dan pergantian tema tanpa error JS.
- R-03/R-32 PASS: layout 375/768/1440 diuji tanpa overflow; navigasi menggunakan tombol native dan status aria-pressed, jumlah orang memiliki label aksesibel.
- R-31 PASS: posisi panel, cahaya, thumbnail dan warna memiliki tujuan yang dicatat di atas. Tidak memakai blur mahal atau efek bloom untuk meniru gambar render.


## Warm studio dan avatar chibi (30 Sep 2026)

Arah dipilih dari referensi yang diberikan pengguna: interior gambar kedua dan avatar gambar terakhir, kemudian disetujui untuk diterapkan. Ruang tetap mengikuti fungsi empat lantai semula. Figur tetap ilustratif; pemetaan enam anggota perempuan, tujuh laki-laki, inisial dan identitas tugas dipertahankan.

Design read: kantor interaktif untuk 13 anggota, interior hangat dengan kayu terang dan karakter chibi; ENERGY 2 / RHYTHM 2 / MOTION 2. Material standar berpermukaan matte menggantikan toon pada benda padat; ACES mengendalikan permukaan terang. Garis tepi dikurangi agar bentuk dan cahaya menjadi pembeda utama. Kepala oval, rambut bervolume, wajah bermata sederhana, pipi dan tangan membulat memakai rig bersendi yang sudah ada. Kursi memakai bantalan, sandaran lembut dan kaki beroda; sofa memakai bantalan sage/krem. Tanaman daun, buku meja dan parket menambah detail yang dekat dengan referensi. Panel gading serta aksen hijau tua menyatukan kontrol dengan interior.

Gate perubahan:
- R-23/R-37 PASS: arah dan pembuatan bentuk disetujui pengguna; semua geometri dibuat langsung di Three.js, tanpa gambar statis menggantikan ruang interaktif.
- R-31/C-1 PASS: keputusan material, furnitur dan UI dijelaskan di atas dan mengikuti referensi.
- R-17/C-5 PASS: figur bukan potret orang nyata, data anggota dan tugas tetap bersumber dari roster serta penyimpanan lama.
- R-26/R-35 PASS: tes soft-avatar lulus untuk rendering, kamera mata/belakang, tangga, jeda dan 13 anggota tiba di meja makan; tidak ada error JavaScript.
- R-32 PASS: komponen kontrol native serta fokus keyboard dipertahankan. Teks putih di aksen hijau tua tetap kontras tinggi.
- R-03/R-35 PASS: tests/member-commands.cjs lulus setelah perubahan material terakhir: kontrol individu/divisi/custom, kapasitas rapat, kamera tetap, tugas aktif dan 375/768/1440px. Screenshot desktop dan mobile ditinjau. Artefak hitam lama masih terlihat di satu screenshot mobile headless; belum dinyatakan diperbaiki.


## Soft-block avatars (30 Sep 2026)

Mengikuti persetujuan pengguna untuk avatar soft block: geometri kepala, badan, rambut, tangan, kaki dan sepatu dibulatkan dengan radius proporsional, memakai cache geometri. Lebar badan dan jarak bahu diperkecil sedikit agar siluet tidak terlalu kaku. Figur tetap ilustratif, dengan inisial dan pembagian gender yang sama.

Pose bersendi sekarang diinterpolasi berdasarkan delta waktu; berjalan, duduk dan aktivitas tidak langsung mengganti sudut sendi. Ditambahkan gerak napas, pergeseran berat badan kecil, fase mengetik/mouse yang berbeda per anggota, dan kepala yang mengikuti arah belok. Mendekati titik tujuan akhir, kecepatan dikurangi. Karakter barber ikut memakai bentuk dan transisi pose baru.

Design read: maket kantor interaktif yang sama; ENERGY 2 / RHYTHM 2 / MOTION 2. Gerak kecil menandakan karakter hidup tanpa mengubah identitas maket atau memperbanyak elemen UI.

Validasi perubahan:
- R-23/R-37 PASS: bentuk avatar dan arah visual diminta serta disetujui pengguna; geometri dibuat dalam kode, tanpa aset unduhan.
- R-03/R-35 PASS: tests/member-commands.cjs lulus pada 375/768/1440px, termasuk cakupan perintah, kapasitas rapat, kamera, tugas aktif dan penyelesaian tugas.
- R-26/R-32 PASS: kontrol yang ada dipertahankan; tests/soft-avatar.cjs memverifikasi kamera mata/belakang, keluar kamera, tangga, jeda serta seluruh 13 anggota tiba di meja makan.
- R-19/R-31 PASS: pose dihaluskan untuk menjelaskan gerakan; tombol jeda tetap menghentikan simulasi. Warna, tipografi dan tata letak tetap mengikuti maket sebelumnya.
- Pemeriksaan sintaks lulus; kedua tes selesai tanpa error JavaScript. Screenshot avatar dekat dan meja makan ditinjau.

Catatan visual yang sudah tercatat sebelumnya masih muncul dalam satu screenshot headless: persegi hitam di samping navigasi setelah berganti lantai. Penyebab artefak tersebut belum terverifikasi dan tidak dinyatakan selesai oleh perubahan avatar ini.


## Perintah anggota dan tugas aktif (30 Sep 2026)

Panel anggota kini memuat tugas aktif (judul dan instruksi), pilihan penerima perintah (individu, divisi, atau daftar khusus), serta rapat/makan/rooftop/kembali kerja. Kamera tidak berpindah akibat perintah. Rapat manual berlangsung sampai diberi perintah berikutnya; kapasitas kursi diperiksa untuk seluruh undangan sebelum ada orang dipindahkan. Kursi makan/rooftop yang sudah menjadi tujuan orang lain tidak dialokasikan ulang.

Design read: panel pengelolaan kantor untuk tim yang sama, maket kertas; ENERGY 2 / RHYTHM 2 / MOTION 2. Tugas diletakkan sebelum aktivitas agar pekerjaan tetap terlihat saat karakter bergerak. Kontrol dikelompokkan dalam panel anggota agar footer global tetap ringkas. Inisial dengan tugas aktif diberi garis merah bata, dengan judul pekerjaan pada tooltip dan accessible label. Panel desktop dimulai di bawah pesan status; log disembunyikan saat detail terbuka. Tidak ada aset visual baru.

Delivery gate:
- R-03/R-35 PASS: tests/member-commands.cjs memeriksa lebar 375/768/1440px, tanpa overflow horizontal panel; tangkapan layar ditinjau, panel memakai scroll vertikal.
- R-26/C-2 PASS: perintah individu, divisi, kelompok khusus, rapat, makan, rooftop, dan kembali kerja memiliki handler; tes memeriksa hanya peserta terpilih yang menerima tujuan baru.
- R-27 PASS: pilihan kosong dan ruangan penuh menghasilkan pesan; undangan gagal tidak memindahkan sebagian peserta. Tugas kosong menampilkan No active task.
- R-32 PASS: select, checkbox berlabel, fieldset/legend, tombol native dan fokus yang diwarisi dari gaya sebelumnya; judul tugas memakai textContent, bukan HTML.
- R-17/C-5 PASS: judul dan penanda tugas berasal dari tugas berstatus active yang tersimpan; menyelesaikan tugas menghapus penanda. Aktivitas tidak menyelesaikan tugas otomatis.
- R-31/R-37 PASS: warna, tipografi, motif garis, serta tata letak mengikuti arah maket yang sudah dipilih; alasan penempatan tercatat di atas.
- R-35 PASS: pengujian browser mencakup kedatangan peserta rapat, kamera tetap, tugas tetap terlihat saat tujuan berubah, selesai tugas, dan tanpa error JavaScript. Pemeriksaan sintaks lulus.


## Avatar balok dan tangga terhubung (29 Sep 2026)

Mengikuti brief terbaru: avatar bergaya balok dengan kepala kotak dan anggota tubuh bersendi. Enam avatar perempuan (Mira, Tari, Rani, Dewi, Laras, Sinta) memakai variasi rambut panjang/poni/kuncir; tujuh avatar laki-laki memakai rambut pendek. Bentuk ini ilustratif, bukan rekonstruksi penampilan orang nyata. Warna kelompok meja dan gaya maket kertas dipertahankan.

Label, pilihan anggota, log, detail, dan penanggung jawab tugas memakai inisial unik. Nama lengkap tetap menjadi identitas internal agar tugas dan pilihan musholla tersimpan tetap kompatibel. Laras = KL dan Sinta = KS agar tidak bertabrakan.

Tiga tangga balik arah menghubungkan keempat lantai di sisi kiri. Avatar menempuh jalur dunia yang sama dengan tangga, tetap terlihat selama perjalanan, dan dapat berganti tujuan tanpa berpindah mendadak. Tombol aktivitas mempertahankan lantai dan kamera; pilihan lantai tetap dikendalikan pengguna. Batas delta animasi dinaikkan dari 50 ke 150 ms untuk mengurangi perlambatan di renderer dengan frame rate rendah, dengan batas loncatan setelah tab kembali aktif.

Musik instrumental sintetis 72 BPM dibuat melalui Web Audio tanpa berkas audio eksternal. Tombol Musik memulai/menghentikan audio; volume tersimpan, pemutaran tidak otomatis. Kontrol tambahan dapat diakses dengan keyboard dan mengikuti tata letak responsif.

Validasi awal: pemeriksaan sintaks JavaScript dan regresi visual/kontrol kamera `tests/office.cjs --visual` lulus. Pemeriksaan pendengaran di perangkat pengguna belum dilakukan; pengujian otomatis audio memeriksa AudioContext, penjadwalan nada, volume, dan penghentian.


## Versi maket kertas (29 Sep 2026)

Design read: visualisasi kantor interaktif untuk tim 13 orang, bahasa visual maket arsitek dari karton, dial ENERGY 2 / RHYTHM 2 / MOTION 2. Arah dipilih pengguna (maket kertas). Bentuk avatar berganti tiga kali atas pilihan pengguna: standee kertas, figur 3D proporsional, lalu avatar balok (versi yang dipakai).

Keputusan dan alasannya:
- Warna: krem kertas #ebe5d8, lembar #faf7f0, tinta #2a2622, satu aksen merah bata #b83a24 untuk tindakan utama, lantai aktif, dan karakter terpilih. Maket nyata dibuat dari karton; navy sebelumnya membuat kantor terasa seperti produk AI lain.
- Empat warna baju tetap mengkodekan kelompok meja (data), juga dipakai pada karpet (tint 16%) dan kotak kecil di log.
- Tipografi: Archivo untuk judul dan UI, karena grotesk tegas seperti huruf pada lembar gambar kerja. IBM Plex Mono kecil (11-12px) hanya untuk nomor lantai, nomor lembar, jam log, dan  seperti keterangan pada gambar teknik. Tidak ada heading monospace besar.
- Motif identitas: title block lembar gambar (caption lantai), navigasi sebagai potongan gedung dengan pelat tebal antar lantai, dan garis tinta pada setiap tepi benda 3D.
- Radius 2px pada kontrol, 4px pada panel; tanpa bayangan UI. Panel dipisahkan garis tinta 1px, seperti kertas yang ditumpuk.
- Avatar: standee kertas diganti dengan figur 3D proporsional bersendi, lalu diganti lagi oleh avatar balok (lihat bagian "Avatar balok dan tangga terhubung" di atas). Pengguna memilih versi balok tersebut; keputusan figur seragam di sini tidak berlaku lagi.
- Lantai 3: kedalaman dibuat tanpa dinding penuh (karpet, papan ide, rak rendah, kaca, lampu gantung, balok) agar brief ruang terbuka tetap berlaku.
- Kota, awan, dan burung kembali atas permintaan pengguna, tetapi hanya pada tampilan seluruh gedung; tampilan satu lantai tetap bersih. Gedung dalam radius 65 dibatasi rendah agar kantor tetap terlihat dari kamera bawaan, dan awan diletakkan melingkar di luar tepi kota agar tidak menutupi layar saat kamera diputar.
- Kota di sekitar gedung dan massa lantai bawah dihapus atas permintaan pengguna. Tampilan satu lantai hanya menampilkan lantai itu, seperti satu lembar maket; tangga luar dan bordes pintunya hanya tampil di tampilan seluruh gedung, karena tanpa lantai lain tangga tampak melayang.
- Musholla: tidak ada yang dikirim otomatis. Keikutsertaan dipilih per orang oleh pengguna karena agama anggota tim nyata tidak boleh diasumsikan.
- Log kantor diberi label "Kegiatan simulasi" agar tidak dibaca sebagai pesan AI.

Kontras (skrip antislop): tinta pada lembar 14.03:1, tinta pada kertas 11.96:1, teks sekunder pada lembar 6.87:1 dan pada kertas 5.86:1, putih pada aksen 5.72:1, aksen pada kertas 4.56:1 (juga cincin fokus), placeholder 5.75:1, teks kecil pada lantai aktif 9.98:1.

Validasi: `tests/office.cjs` lulus di Chromium headless. Tercakup: 13 anggota, 4 lantai, klik lantai dari tampilan gedung, seret orbit, Shift + seret geser, scroll zoom (termasuk di atas label nama), rutinitas dan ngobrol, batas empat orang, log terisi, Waktu salat tanpa pilihan menampilkan petunjuk, hanya anggota yang dicentang ke musholla, pilihan tersimpan setelah reload, tugas, makan/rooftop/kembali, 375/768/1440px tanpa overflow, tombol Log di ponsel, tanpa error JavaScript. Tangkapan layar ditinjau pada 375, 768, dan 1440px.

Belum terverifikasi: pada satu urutan pengujian (dialog tugas dibuka, lalu tim turun makan), tangkapan layar Chromium headless menunjukkan satu area transparan di samping navigasi lantai. Raycast dan elementFromPoint di titik itu hanya menemukan kanvas dan gedung kota, dan pola ini belum dapat dijelaskan. Belum diperiksa di browser biasa.

Gate antislop versi ini: R-02 tanpa em dash di teks UI; R-03 tiga lebar diuji; R-17 angka hanya dari data (13 orang, 4 lantai, jumlah tugas); R-23 bentuk avatar dikonfirmasi pengguna, tetap ilustratif; R-25 kontras di atas; R-26/R-35 setiap kontrol diuji otomatis; R-27 pesan memuat, gagal CDN/WebGL, log kosong, tugas kosong/gagal; R-32 fokus merah bata 3px, Escape menutup dialog, panah/WASD menggerakkan kamera; R-37 arah dipilih pengguna. PASS.


Versi terbaru mengikuti brief pengguna: 13 nama dan jabatan, empat lantai, satu ruang kerja terbuka tanpa partisi, dan kelompok meja yang ditentukan selama implementasi. Avatar, ukuran, furnitur, dan lokasi tangga merupakan interpretasi yang dilabeli di layar.

## Keputusan visual terbaru

ENERGY 1 / RHYTHM 2 / MOTION 2 untuk adegan kantor. Panel tugas mempertahankan MOTION 1. Adegan 3D merupakan fokus utama; kontrol lantai disusun vertikal mengikuti tingkat gedung dan berpindah ke atas pada tablet/ponsel. Navy memisahkan kontrol dari lantai berwarna terang; biru menunjukkan lantai aktif. Warna baju yang berbeda menandai empat kelompok meja, bukan menebak pakaian atau ciri personal tim. Kayu, beton, dan tanaman membedakan fungsi ruang. Font sistem, permukaan solid, dan label tindakan mengikuti sistem tugas sebelumnya. Animasi menjelaskan perjalanan dan aktivitas, dengan tombol jeda.

## Validasi versi terbaru

Pengujian Chromium lulus: 13 anggota tim, jabatan Frontend/Backend, 13 pilihan penanggung jawab, keempat lantai dan tampilan gedung, detail karakter, pembuatan/penyelesaian tugas, pause/resume, zoom/putar/reset, semua 13 karakter tiba di meja makan, rooftop, dan kembali ke meja masing-masing. Tugas lama milik Sari berhasil dipindahkan ke Kak Rani, dimulai, dan dipertahankan setelah reload. Tidak ada error JavaScript. Pemeriksaan sintaks JavaScript juga lulus.

Tangkapan layar ditinjau pada 375, 768, dan 1440px. Kamera menyesuaikan rasio layar agar lantai muat; label dipadatkan saat zoom jauh di ponsel. Dropdown selalu menyediakan seluruh tim. Tampilan gedung menyembunyikan label nama agar tidak bertumpuk dengan lantai atas. Pengujian mobile menggunakan viewport Chromium, bukan perangkat fisik.

## Gate antislop versi terbaru

- R-01 PASS: tidak ada gradien atau glow pada UI; pencahayaan 3D menunjukkan bentuk ruang.
- R-02 PASS: copy baru tanpa em dash.
- R-03 PASS: 375/768/1440px diuji; navigasi atas dan kamera adaptif pada layar kecil.
- R-04 PASS: kontrol berlabel teks, tanpa ikon generik.
- R-05 PASS: navigasi disusun menurut empat lantai yang diberikan pengguna.
- R-06 PASS: font sistem mengikuti kontrol tugas; ukuran membedakan judul, nama, dan keterangan.
- R-07 PASS: tanpa pola latar UI dekoratif.
- R-08 PASS: tanpa panah dekoratif berulang.
- R-09 PASS: angka lantai dan tugas berasal dari struktur dan data nyata aplikasi.
- R-10 PASS: permukaan kontrol solid, tanpa blur.
- R-11 PASS: radius kecil pada kontrol, lebih besar pada panel.
- R-12 PASS: bayangan 3D menunjukkan kontak furnitur dengan lantai.
- R-13 PASS: tidak ada glow.
- R-14 PASS: tidak menambahkan kartu fitur.
- R-15 PASS: kontrol spesifik: Turun makan, Ke rooftop, Kembali kerja.
- R-16 PASS: copy tidak menjanjikan eksekusi AI.
- R-17 PASS: 13 anggota sesuai data pengguna; jumlah tugas dihitung dari penyimpanan.
- R-18 PASS: tidak ada testimoni.
- R-19 PASS: animasi menampilkan perjalanan/aktivitas dan dapat dijeda.
- R-20 PASS: nama tim, fungsi lantai, dan empat kelompok meja berasal dari brief.
- R-21 PASS: tema navy mempertahankan konteks kantor 3D sebelumnya.
- R-22 PASS: seluruh geometri merupakan kantor yang diminta, bukan ilustrasi dekoratif generik.
- R-23 PASS: anggota tim dari pengguna; bentuk karakter dan denah ditandai sebagai interpretasi.
- R-24 PASS: semua tombol lantai dan pilihan tim memiliki tujuan yang diuji.
- R-25 PASS: teks sekunder pada kontrol lantai aktif diubah menjadi putih, 5.85:1; pasangan UI lain mengikuti panel yang telah dihitung.
- R-26 PASS: kontrol lantai, kamera, tim, simulasi, dan tugas diuji.
- R-27 PASS: pesan memuat, kegagalan CDN/WebGL, serta empty/error tugas tersedia.
- R-28 PASS: tidak ada FAQ.
- R-29 PASS: UI navy/netral/biru; empat warna baju mengkodekan kelompok meja.
- R-30 PASS: visual mengikuti deskripsi kantor pengguna.
- R-31 PASS: alasan keputusan dicatat di atas.
- R-32 PASS: label nama adalah tombol; dropdown memberi akses seluruh anggota, kontrol kamera dan lantai dapat difokuskan, dialog mendukung Escape.
- R-33 PASS: geometri, UI, dan logika ditulis langsung dalam sumber.
- R-34 PASS: satu tema konsisten tanpa toggle yang tidak berfungsi.
- R-35 PASS: server lokal, Chromium, alur interaktif, serta tangkapan layar digunakan.
- R-36 PASS: tidak menambahkan klaim performa/keamanan.
- R-37 PASS: arah eksplisit berasal dari screenshot dan deskripsi empat lantai pengguna.
- R-38 PASS: interpretasi denah, karakter ilustratif, dan kegiatan simulasi dinyatakan di UI.
- Liveliness PASS: adegan kantor fokus utama, navigasi mengikuti urutan lantai, satu aksen aktif, ruang kosong memisahkan model dari kontrol.
- C-1 PASS: keputusan utama memiliki alasan tertulis.
- C-2 PASS: semua kelompok kontrol diuji dengan browser.
- C-3 PASS: tiap lantai berasal dari fungsi yang disebut pengguna.
- C-4 PASS: tiga lebar layar, perpindahan lantai, tugas lama, dan reload diuji.
- C-5 PASS: nama/jabatan dari pengguna; rupa avatar bukan klaim kemiripan asli.

## Arsip: pemeriksaan sistem tugas versi awal

Lingkup: panel tugas baru dan penghubungnya dengan karakter. Ini bukan audit seluruh antarmuka 3D bawaan.

## Keputusan tampilan

Mengikuti referensi kantor 3D pengguna. ENERGY 1 / RHYTHM 2 / MOTION 1 untuk panel tugas.

- Warna gelap mengikuti ruang kerja yang sudah ada dan memisahkan formulir dari adegan 3D yang terang.
- Biru menandai tindakan utama; status ditulis dengan teks.
- Dua kolom menghubungkan formulir dengan daftar pekerjaan; satu kolom di ponsel menjaga ruang baca.
- Font sistem mengikuti kontrol kantor yang ada, tanpa unduhan font tambahan.
- Jarak 32px memisahkan formulir dari daftar; jarak lebih kecil mengelompokkan label dan input.
- Garis pemisah mengurutkan tugas; tidak ada kartu dekoratif atau ikon tambahan.
- Dialog native memberi fokus modal dan penutupan dengan Escape.

## Bukti pengujian

Pengujian Chromium otomatis: membuat tugas, teks HTML diperlakukan sebagai teks, penugasan, batas satu tugas aktif, penyelesaian dengan hasil, filter, ekspor JSON, persistensi setelah reload, navigasi ke karakter, tugas berlanjut sesudah salat, Tab/Shift+Tab/Escape, dan shortcut kamera saat mengetik. Skenario penyimpanan gagal dan JSON rusak tidak menimpa data. Tidak ada error JavaScript pada rangkaian pengujian.

Tampilan diperiksa melalui tangkapan layar pada lebar 375, 768, dan 1440px. Dialog tidak memiliki overflow horizontal. Tombol panel minimum 44px; kontrol masuk panel juga minimum 44px.

Kontras dihitung dengan rumus WCAG dan script antislop: teks utama 14.45:1, teks sekunder 9.16:1, placeholder 7.42:1, tombol utama 5.85:1, tombol biasa 10.86:1, hover 8.01:1, pressed 5.78:1, fokus pada input 8.34:1. Batas input 3.53:1 terhadap isi input.

## Gate antislop

- R-01 PASS: tidak menambahkan gradien atau glow.
- R-02 PASS: copy panel tanpa em dash.
- R-03 PASS: tiga lebar diuji tanpa overflow horizontal.
- R-04 PASS: kontrol baru memakai label teks tanpa ikon generik.
- R-05 PASS: formulir dan daftar mengikuti alur pemberian pekerjaan.
- R-06 PASS: font sistem mengikuti kontrol aplikasi yang ada.
- R-07 PASS: tidak menambahkan pola latar.
- R-08 PASS: tidak menambahkan panah dekoratif.
- R-09 PASS: status berupa teks yang berasal dari data tugas.
- R-10 PASS: panel baru menggunakan permukaan solid tanpa blur.
- R-11 PASS: radius dialog 12px dan input/tombol 6px.
- R-12 PASS: tidak menambahkan bayangan dekoratif.
- R-13 PASS: tidak menambahkan glow.
- R-14 PASS: tugas berupa daftar, bukan kartu fitur seragam.
- R-15 PASS: tombol menyebut tindakan konkret, seperti Tambahkan tugas.
- R-16 PASS: copy menjelaskan fungsi tanpa klaim pemasaran AI.
- R-17 PASS: jumlah tugas dihitung dari data pengguna.
- R-18 PASS: tidak menambahkan testimoni.
- R-19 PASS: panel tidak menambahkan animasi dekoratif.
- R-20 PASS: tugas terhubung dengan karakter kantor yang sudah ada.
- R-21 PASS: tema mengikuti referensi dan lingkungan 3D yang sudah ada.
- R-22 PASS: tidak menambahkan ilustrasi.
- R-23 PASS: tidak menambahkan identitas atau karakter fiktif baru.
- R-24 PASS: Lihat karakter membuka karakter terkait.
- R-25 PASS: pasangan warna teks panel dihitung, minimum 5.78:1.
- R-26 PASS: tombol baru diuji melalui alur browser.
- R-27 PASS: keadaan kosong dan gagal simpan terbaca; operasi localStorage sinkron tidak memerlukan loading jaringan.
- R-28 PASS: tidak menambahkan FAQ.
- R-29 PASS: panel memakai navy, netral, dan satu aksen biru.
- R-30 PASS: mengikuti prototipe pengguna, bukan menyalin produk lain.
- R-31 PASS: alasan keputusan tampilan dicatat di atas.
- R-32 PASS: kontrol native, fokus terlihat, Tab/Shift+Tab/Escape diuji.
- R-33 PASS: perubahan ditulis langsung melalui patch sumber.
- R-34 PASS: tidak memperkenalkan toggle tema.
- R-35 PASS: aplikasi dijalankan di server lokal dan alur tugas diuji di Chromium.
- R-36 PASS: tidak menambahkan klaim keamanan atau performa.
- R-37 PASS: arah berasal dari referensi pengguna dan dial dinyatakan sebelum implementasi.
- R-38 PASS: status manual dan batas simulasi dijelaskan di panel.
- Liveliness PASS: judul tugas menjadi fokus dialog; jarak memisahkan kelompok; aksen biru menandai tindakan; karakter menghubungkan panel dengan kantor.
- C-1 PASS: alasan desain dicatat.
- C-2 PASS: kontrol baru memiliki perilaku yang diuji.
- C-3 PASS: setiap bagian mendukung pembuatan, pencarian, atau penyelesaian tugas.
- C-4 PASS: empty/error states, keyboard, dan tiga lebar diuji.
- C-5 PASS: penghitung memakai data pengguna; hasil tidak dibuat otomatis.

## Batas versi ini

Tidak ada eksekusi AI, sinkronisasi antarperangkat/tab, atau impor JSON. Pengujian mobile memakai viewport Chromium, bukan perangkat fisik. Three.js masih dimuat melalui CDN prototipe.
## Office life — October 2026

### Work board, review, decorations and tours

Arahan melanjutkan interior kayu hangat, panel gading, aksen hijau tua; ENERGY 2 / RHYTHM 2 / MOTION 1. Status monitor memakai data tugas pemiliknya. Papan berisi hasil dan status nyata, dengan akses keyboard melalui Work board di Office life. Review menyebut versi draf dan tidak menyetujui pekerjaan. Anggota tanpa koneksi AI tetap berlabel simulasi. Catatan dry-run berlabel jelas.

Dekorasi berupa pilihan warna furnitur/daun dan dua poster, tanpa mengubah denah. Hujan digambar di luar footprint gedung sebagai satu batch garis; audio berupa noise tersaring, opt-in dan tidak autoplay. Tur berhenti saat input kamera manual, dapat dijeda, dan menjadi sudut diam untuk reduced motion. Pergerakan hujan juga dilewati untuk reduced motion. Lampu tetap mengikuti lantainya.

Panel baru memakai dialog native, label/fokus terlihat, target 44px, satu kolom di ponsel dan header Close yang tetap terlihat saat scroll. Screenshot Appearance & tours pada 375/768/1440px serta workspace berhujan ditinjau. tests/office-studio.cjs memeriksa status/klik monitor, hasil kerja, exact task navigation, review dua agen tanpa approval, guard versi lama, dekorasi tersimpan, weather/audio/tours dan reduced motion. Regresi tests/office-life.cjs lulus setelah penambahan fitur. Pengujian memakai dry-run, tidak menjalankan model berbayar.

Pemeriksaan akhir: tests/server.cjs dan tests/office-studio.cjs lulus, termasuk klik papan 3D dan penanda stale ketika tugas berubah saat review berlangsung. Pemeriksaan sintaks dan git diff --check bersih.

Perbaikan mode malam: lampu dan strip cahaya menjadi bagian dari lantainya, sehingga lantai tersembunyi tidak menyisakan lampu melayang. Regresi memeriksa lampu Workspace, Rooftop, seluruh gedung dan kembali ke Workspace; screenshot malam Workspace ditinjau.

Arahan mengikuti kantor hangat yang sudah ada: kayu, sage, panel gading; kontrol Office life menggunakan hijau tua untuk tindakan. Tidak menambah gaya visual baru. ENERGY 2 / RHYTHM 2 / MOTION 1: gerak kecil membantu membaca kegiatan, jeda tetap berlaku dan preferensi reduced motion menonaktifkan rutinitas bawaan serta gerak selebrasi.

Panel berisi kegiatan kantor, coffee break, dan brief divisi dengan preview sebelum penyimpanan. Elemen memakai label, fokus terlihat, tombol minimal 44px, dialog native dengan Escape, dan satu kolom pada layar sempit. Tugas divisi disimpan atomik. Tanggapan AI berasal dari endpoint server; dry-run berlabel dan aktivitas karakter tetap disebut simulasi.

Validasi: tests/server.cjs dan tests/worker-reliability.cjs lulus. tests/office-life.cjs lulus untuk batch invalid tanpa tugas parsial, cat pet/pause, kebiasaan, selebrasi setelah approval, pencahayaan tersimpan, coffee dua agen berurutan, unduhan catatan, localStorage tanpa server dan lebar 375/768/1440px tanpa overflow dialog atau error JavaScript. Screenshot panel desktop dan ponsel ditinjau; jarak header diperketat setelah review. API model berbayar tidak dipanggil dalam pengujian.
