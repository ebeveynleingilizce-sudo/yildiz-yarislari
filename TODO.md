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
- [x] Öğretmen e-posta/parola ve Google girişi, öğrenci anonim oturumu ve canlı roster eşitlemesini ekle.
- [x] Veriyi öğretmen Firebase UID'sine göre ayır; öğrenci bağlantılarıyla salt okunur yarış listesini paylaş.
- [x] Öğretmen için yıldız kazanma yollarını düzenleme, yıldız miktarı ve etkin/pasif alanları ekle.
- [x] Hesap izolasyonlu `database.rules.json` kurallarını Firebase Realtime Database'e yayımla; Firebase CLI sözdizimini onayladı.
- [ ] JDK 21+ kurup Rules Emulator'da A/B izinlerini çalıştır veya gerçek tunc/serkan hesaplarıyla dene.
- [ ] Firebase Authentication içinde Anonymous, Email/Password ve Google sağlayıcılarını etkinleştir; yetkili alan adını doğrula.
- [x] Güncel dosyaları GitHub Pages'e gönder; GitHub Actions dağıtım işi başarılı.
- [ ] Gerçek iki öğretmen hesabı ve öğrenci paylaşım bağlantısıyla canlı eşitlemeyi doğrula.

## Sunucu gerektiren işler

- [ ] iOS Safari, Android Chrome ve masaüstünde iki ayrı PWA kurulumunu gerçek cihaz/tarayıcılarla doğrula.

Firebase kuralları uygulama dosyasında hesap bazlı erişimi tarif eder. Firebase Console'da yayımlama, Google sağlayıcısını etkinleştirme ve gerçek hesaplarla doğrulama adımları hâlâ gerekli.
