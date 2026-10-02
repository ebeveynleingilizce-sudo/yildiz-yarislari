# YILDIZ YARIŞLARI — yapılacaklar

## Tamamlandı

- [x] Öğretmen ve öğrenci görünümünü aynı yarış ekranında tut; öğretmen panelini öğretmen bağlantısında aç.
- [x] Öğretmen sekmesinden verilen yıldızları diğer açık sekmeye aktar ve karakteri orada da pist boyunca animasyonla ilerlet.
- [x] Öğrenci ekranında ilerleme güncellemelerini sesli ve animasyonlu bildir; son ziyaret ilerlemesini hatırla.
- [x] Öğretmen panelinde karakter seçicinin başlığında seçili öğrenciyi adıyla belirt.
- [x] Seviyeyi 10 ile sınırla; tecrübe puanı 100 olduğunda seviye 10 ve Uzman Öğrenci unvanı göster.
- [x] Yeni turda pist yıldızlarını sıfırla; toplam tecrübe, ömür boyu yıldızlar ve daha önce kazanılmış başarıları koru.
- [x] Öğretmen görünümü stillerindeki birbiriyle çakışan eski kuralları kaldır.
- [x] Karakter seçeneklerini her öğrencinin resmine bağla; ayrı karakter seçimi bölümünü kaldır.
- [x] Yıldız sıfırlama ve yeni tur işlemlerinden sonra görünür durum/başarı bildirimi göster.

## Firebase bağlantısı

- [x] Firebase web yapılandırmasını ve Realtime Database bağlantısını ekle.
- [x] Öğretmen e-posta/parola girişi, öğrenci anonim oturumu ve canlı roster eşitlemesini ekle.
- [x] Realtime Database kurallarını yayımla: oturum açanlar okuyabilir, yalnızca öğretmen e-postası yazabilir.
- [ ] Firebase Authentication içinde Anonymous ve Email/Password sağlayıcılarını etkinleştir; öğretmen hesabını doğrula.
- [ ] Güncel dosyaları statik hosting'e yayımla ve iki ayrı cihaz/oturumda canlı eşitlemeyi doğrula.

## Sunucu gerektiren işler

- [ ] Uygulamayı statik hosting'e yayımla. Firebase Hosting veya Netlify kullanılabilir.
- [ ] Herkese açık öğrenci bağlantısında gerçek adlar yerine takma ad/baş harf kullanmayı değerlendir; anonim Firebase oturumu olan ziyaretçiler salt okunur sınıf listesini görebilir.

Öğretmen hesabı, Firebase Authentication ve veritabanı yetki kuralları uygulama koduna eklendi. Firebase Console'da sağlayıcıları etkinleştirme ve siteyi yayınlama adımları hâlâ gerekli.
