(() => {
  "use strict";
  const bank = [];
  const add = (lesson, topic, prefix, rows) => rows.forEach((row, index) => {
    const [question, answer, wrong, difficulty = "easy"] = row;
    const choices = [answer, ...wrong].filter((choice, i, all) => all.indexOf(choice) === i).slice(0, 4);
    while (choices.length < 4) choices.push(String(Number(choices.at(-1)) + choices.length + 2));
    bank.push({ id: `${prefix}_${String(index + 1).padStart(3, "0")}`, lesson, topic, question, choices, correctAnswer: 0, difficulty });
  });
  const nums = (start, step, count = 20) => Array.from({ length: count }, (_, i) => start + i * step);
  const math = "Matematik";
  const natural = nums(132, 37).map((n, i) => {
    const digits = String(n * (i % 2 ? 10 : 1)).padStart(i % 2 ? 4 : 3, "0");
    const places = ["birler", "onlar", "yüzler", "binler"];
    const place = i % places.length;
    const answer = digits[digits.length - 1 - place] || "0";
    return [`${digits} sayısında ${places[place]} basamağındaki rakam hangisidir?`, answer, ["0", "2", "5", "8"].filter(x => x !== answer)];
  });
  add(math, "Doğal Sayılar", "math_natural", natural);
  add(math, "Toplama", "math_add", nums(17, 9).map((n, i) => [`${n} + ${i + 8} işleminin sonucu kaçtır?`, String(n + i + 8), [String(n + i + 7), String(n + i + 9), String(n + i + 18)]]));
  add(math, "Çıkarma", "math_sub", nums(64, 7).map((n, i) => [`${n} − ${i + 9} işleminin sonucu kaçtır?`, String(n - i - 9), [String(n - i - 8), String(n - i - 10), String(n + i + 9)]]));
  add(math, "Çarpma", "math_multiply", nums(2, 1).map((n, i) => [`${n} × ${i % 9 + 2} işleminin sonucu kaçtır?`, String(n * (i % 9 + 2)), [String(n * (i % 9 + 1)), String(n * (i % 9 + 3)), String(n + (i % 9 + 2))]]));
  add(math, "Bölme", "math_divide", nums(2, 1).map((n, i) => { const divisor = i % 8 + 2; return [`${n * divisor} ÷ ${divisor} işleminin sonucu kaçtır?`, String(n), [String(n + 1), String(Math.max(1, n - 1)), String(n * divisor)]]; }));
  add(math, "Kesirler", "math_fractions", Array.from({ length: 20 }, (_, i) => {
    const numerator = i % 8 + 1, denominator = numerator + (i % 5 + 1);
    const askNumerator = i % 2 === 0;
    const answer = String(askNumerator ? numerator : denominator);
    return [`${numerator}/${denominator} kesrinde ${askNumerator ? "pay" : "payda"} hangisidir?`, answer, [String(denominator), String(numerator), String(numerator + denominator)].filter(x => x !== answer)];
  }));
  const objects = ["kalem", "elma", "kitap", "bilye", "çıkartma"];
  add(math, "Problemler", "math_problems", nums(3, 2).map((n, i) => { const extra = i + 4; return [`${n} ${objects[i % objects.length]} vardı, ${extra} tane daha geldi. Şimdi kaç tane var?`, String(n + extra), [String(n + extra - 1), String(n + extra + 1), String(n * extra)]]; }));

  const turkish = "Türkçe";
  const synonymRows = [
    ["Mutlu sözcüğünün eş anlamlısı nedir?", "Sevinçli", ["Üzgün", "Yorgun", "Kızgın"]], ["Yanıt sözcüğünün eş anlamlısı nedir?", "Cevap", ["Soru", "Ödev", "Konu"]],
    ["Yürek sözcüğünün eş anlamlısı nedir?", "Kalp", ["Akıl", "Beyin", "El"]], ["Siyah sözcüğünün eş anlamlısı nedir?", "Kara", ["Beyaz", "Gri", "Mavi"]],
    ["Yıl sözcüğünün eş anlamlısı nedir?", "Sene", ["Ay", "Hafta", "Gün"]], ["Misafir sözcüğünün eş anlamlısı nedir?", "Konuk", ["Ev sahibi", "Komşu", "Arkadaş"]],
    ["Hekim sözcüğünün eş anlamlısı nedir?", "Doktor", ["Hemşire", "Hasta", "Eczacı"]], ["Öğrenci sözcüğünün eş anlamlısı nedir?", "Talebe", ["Öğretmen", "Okul", "Sınıf"]],
    ["Ulus sözcüğünün eş anlamlısı nedir?", "Millet", ["Şehir", "Ülke", "Köy"]], ["Vazife sözcüğünün eş anlamlısı nedir?", "Görev", ["Tatil", "Oyun", "Ödül"]],
    ["Doğa sözcüğünün eş anlamlısı nedir?", "Tabiat", ["Orman", "Bahçe", "Dağ"]], ["Sürat sözcüğünün eş anlamlısı nedir?", "Hız", ["Yön", "Güç", "Ağırlık"]],
    ["İhtiyar sözcüğünün eş anlamlısı nedir?", "Yaşlı", ["Genç", "Çocuk", "Yeni"]], ["Fakir sözcüğünün eş anlamlısı nedir?", "Yoksul", ["Zengin", "Cimri", "Cömert"]],
    ["Irak sözcüğünün eş anlamlısı nedir?", "Uzak", ["Yakın", "İleri", "Geniş"]], ["Cümle sözcüğünün eş anlamlısı nedir?", "Tümce", ["Kelime", "Hece", "Harf"]],
    ["Özgür sözcüğünün eş anlamlısı nedir?", "Hür", ["Esir", "Yalnız", "Sessiz"]], ["Neden sözcüğünün eş anlamlısı nedir?", "Sebep", ["Sonuç", "Çözüm", "Örnek"]],
    ["Kırmızı sözcüğünün eş anlamlısı nedir?", "Al", ["Ak", "Yeşil", "Mor"]], ["Yetenek sözcüğünün eş anlamlısı nedir?", "Kabiliyet", ["Alışkanlık", "Bilgi", "Davranış"]],
  ];
  add(turkish, "Sözcükte Anlam", "turkish_meaning", synonymRows);
  const grammarWords = [
    ["‘Koştu’ sözcüğü hangi türdedir?", "Fiil", ["İsim", "Sıfat", "Zamir"]], ["‘Mavi’ sözcüğü ‘mavi kalem’ ifadesinde hangi türdedir?", "Sıfat", ["Fiil", "Zamir", "Bağlaç"]],
    ["‘Masa’ sözcüğü hangi türdedir?", "İsim", ["Fiil", "Sıfat", "Zarf"]], ["‘Ben’ sözcüğü hangi türdedir?", "Zamir", ["İsim", "Fiil", "Sıfat"]],
    ["‘Hızlıca’ sözcüğü hangi türdedir?", "Zarf", ["İsim", "Fiil", "Zamir"]], ["‘ve’ sözcüğü hangi türdedir?", "Bağlaç", ["İsim", "Fiil", "Sıfat"]],
    ["‘Güzel çiçek’ ifadesinde ‘güzel’ hangi türdedir?", "Sıfat", ["İsim", "Fiil", "Zamir"]], ["‘Uyuyor’ sözcüğünün kökü hangi türdedir?", "Fiil", ["İsim", "Sıfat", "Zarf"]],
    ["‘Okul’ sözcüğü hangi türdedir?", "İsim", ["Fiil", "Zamir", "Bağlaç"]], ["‘Onlar’ sözcüğü hangi türdedir?", "Zamir", ["Sıfat", "Fiil", "Zarf"]],
    ["‘Çünkü’ sözcüğü hangi türdedir?", "Bağlaç", ["İsim", "Fiil", "Sıfat"]], ["‘Sessizce’ sözcüğü hangi türdedir?", "Zarf", ["İsim", "Zamir", "Fiil"]],
    ["‘Çalışkan öğrenci’ ifadesinde ‘çalışkan’ hangi türdedir?", "Sıfat", ["Fiil", "İsim", "Zamir"]], ["‘Gülüyor’ sözcüğü hangi türdedir?", "Fiil", ["İsim", "Sıfat", "Bağlaç"]],
    ["‘Kitaplar’ sözcüğünün kökü hangi türdedir?", "İsim", ["Fiil", "Zarf", "Bağlaç"]], ["‘Biz’ sözcüğü hangi türdedir?", "Zamir", ["Fiil", "İsim", "Sıfat"]],
    ["‘Fakat’ sözcüğü hangi türdedir?", "Bağlaç", ["İsim", "Fiil", "Zamir"]], ["‘Erken’ sözcüğü ‘erken kalktı’ ifadesinde hangi türdedir?", "Zarf", ["İsim", "Fiil", "Bağlaç"]],
    ["‘Kırmızı araba’ ifadesinde ‘kırmızı’ hangi türdedir?", "Sıfat", ["İsim", "Fiil", "Zamir"]], ["‘Yazdı’ sözcüğü hangi türdedir?", "Fiil", ["İsim", "Sıfat", "Zarf"]],
  ];
  add(turkish, "Dil Bilgisi", "turkish_grammar", grammarWords);
  const punctuation = [
    ["Soru cümlesinin sonuna hangi işaret konur?", "Soru işareti (?)", ["Nokta (.)", "Virgül (,) ", "Ünlem (!)"]], ["Sevinç bildiren cümlenin sonuna hangi işaret konur?", "Ünlem (!) ", ["Nokta (.)", "Virgül (,) ", "İki nokta (:)"]],
    ["Cümlenin sonuna genellikle hangi işaret konur?", "Nokta (.)", ["Virgül (,) ", "Soru işareti (?)", "Kesme (')"]], ["Eş görevli sözcükleri ayırmak için ne kullanılır?", "Virgül (,) ", ["Nokta (.)", "Soru işareti (?)", "Ünlem (!)"]],
    ["Özel adlar nasıl başlar?", "Büyük harfle", ["Küçük harfle", "Rakamla", "Noktalama işaretiyle"]], ["‘Ankara’ özel ad mıdır?", "Evet", ["Hayır", "Fiildir", "Bir noktalama işaretidir"]],
    ["‘Ali bugün geldi.’ cümlesi hangi işaretle biter?", "Nokta (.)", ["Soru işareti (?)", "Virgül (,) ", "Ünlem (!)"]], ["Birine seslenirken cümlede hangi işaret kullanılabilir?", "Virgül (,) ", ["Nokta (.)", "Kesme (')", "Tire (-)"]],
    ["‘Eyvah’ sözü hangi duyguyu bildirir?", "Korku/şaşkınlık", ["Soru", "Karşılaştırma", "Zaman"]], ["‘?’ işaretinin adı nedir?", "Soru işareti", ["Nokta", "Virgül", "Ünlem"]],
    ["Cümle başında hangi harf kullanılır?", "Büyük harf", ["Küçük harf", "Sayı", "Kesme işareti"]], ["‘Bugün hava güzel mi’ cümlesinin sonuna ne konur?", "Soru işareti (?)", ["Nokta (.)", "Virgül (,) ", "İki nokta (:)"]],
    ["‘Yaşasın’ sözü hangi işaretle tamamlanır?", "Ünlem (!)", ["Nokta (.)", "Virgül (,) ", "Soru işareti (?)"]], ["Kitap adları yazılırken ilk sözcük nasıl başlar?", "Büyük harfle", ["Küçük harfle", "Rakamla", "Sembol ile"]],
    ["‘Ayşe, buraya gelir misin?’ cümlesinde virgül ne için kullanılmıştır?", "Seslenmeyi ayırmak için", ["Cümleyi bitirmek için", "Soru sormak için", "Özel adı göstermek için"]], ["‘!’ işaretinin adı nedir?", "Ünlem", ["Nokta", "Virgül", "Soru işareti"]],
    ["‘İstanbul’ sözcüğü nasıl yazılır?", "İlk harfi büyük", ["Tümü küçük", "İlk harfi noktalı virgül", "Rakamla"]], ["Bir cümlede kısa duraklamayı hangi işaret gösterir?", "Virgül (,) ", ["Nokta (.)", "Soru işareti (?)", "Ünlem (!)"]],
    ["‘Nereye gidiyorsun’ cümlesi hangi işaretle biter?", "Soru işareti (?)", ["Nokta (.)", "Virgül (,) ", "Ünlem (!)"]], ["Cümle içinde özel isimden sonra gelen ek nasıl ayrılır?", "Kesme işaretiyle", ["Virgülle", "Noktayla", "Soru işaretiyle"]],
  ];
  add(turkish, "Yazım ve Noktalama", "turkish_punctuation", punctuation);

  const english = "İngilizce";
  const vocab = [
    ["‘Apple’ kelimesinin Türkçesi nedir?", "Elma", ["Armut", "Muz", "Üzüm"]], ["‘Book’ kelimesinin Türkçesi nedir?", "Kitap", ["Kalem", "Masa", "Kapı"]], ["‘Water’ kelimesinin Türkçesi nedir?", "Su", ["Süt", "Ekmek", "Çay"]],
    ["‘Cat’ kelimesinin Türkçesi nedir?", "Kedi", ["Köpek", "Kuş", "Balık"]], ["‘Dog’ kelimesinin Türkçesi nedir?", "Köpek", ["Kedi", "At", "Tavşan"]], ["‘Red’ kelimesinin Türkçesi nedir?", "Kırmızı", ["Mavi", "Yeşil", "Sarı"]],
    ["‘Blue’ kelimesinin Türkçesi nedir?", "Mavi", ["Siyah", "Mor", "Turuncu"]], ["‘Green’ kelimesinin Türkçesi nedir?", "Yeşil", ["Kırmızı", "Beyaz", "Pembe"]], ["‘School’ kelimesinin Türkçesi nedir?", "Okul", ["Ev", "Park", "Dükkan"]],
    ["‘Teacher’ kelimesinin Türkçesi nedir?", "Öğretmen", ["Öğrenci", "Doktor", "Aşçı"]], ["‘Friend’ kelimesinin Türkçesi nedir?", "Arkadaş", ["Aile", "Öğretmen", "Komşu"]], ["‘Sun’ kelimesinin Türkçesi nedir?", "Güneş", ["Ay", "Yıldız", "Bulut"]],
    ["‘Moon’ kelimesinin Türkçesi nedir?", "Ay", ["Güneş", "Dünya", "Yıldız"]], ["‘One’ kelimesinin Türkçesi nedir?", "Bir", ["İki", "Üç", "Dört"]], ["‘Happy’ kelimesinin Türkçesi nedir?", "Mutlu", ["Üzgün", "Yorgun", "Aç"]],
    ["‘Big’ kelimesinin Türkçesi nedir?", "Büyük", ["Küçük", "Uzun", "Kısa"]], ["‘Small’ kelimesinin Türkçesi nedir?", "Küçük", ["Büyük", "Geniş", "Hızlı"]], ["‘Good morning’ ne demektir?", "Günaydın", ["İyi geceler", "Hoşça kal", "Teşekkürler"]],
    ["‘Thank you’ ne demektir?", "Teşekkür ederim", ["Lütfen", "Günaydın", "Özür dilerim"]], ["‘Please’ ne demektir?", "Lütfen", ["Merhaba", "Güle güle", "Evet"]],
  ];
  add(english, "Kelime Bilgisi", "english_vocabulary", vocab);
  const grammar = [
    ["I ___ a student.", "am", ["is", "are", "be"]], ["She ___ my friend.", "is", ["am", "are", "be"]], ["They ___ happy.", "are", ["am", "is", "be"]], ["He ___ a teacher.", "is", ["am", "are", "be"]],
    ["We ___ at school.", "are", ["am", "is", "be"]], ["It ___ a red ball.", "is", ["am", "are", "be"]], ["You ___ kind.", "are", ["am", "is", "be"]], ["I ___ ten years old.", "am", ["is", "are", "be"]],
    ["A cat has ___ legs.", "four", ["two", "six", "eight"]], ["There ___ one book.", "is", ["am", "are", "be"]], ["There ___ three apples.", "are", ["am", "is", "be"]], ["This is ___ orange.", "an", ["a", "the", "are"]],
    ["This is ___ pencil.", "a", ["an", "are", "am"]], ["The plural of ‘book’ is ___.", "books", ["bookes", "book", "bookies"]], ["The plural of ‘box’ is ___.", "boxes", ["boxs", "boxies", "box"]], ["‘He’ is used for a ___.", "boy/man", ["girl/woman", "thing", "place"]],
    ["‘She’ is used for a ___.", "girl/woman", ["boy/man", "thing", "place"]], ["‘We’ means ___.", "biz", ["ben", "sen", "onlar"]], ["‘They’ means ___.", "onlar", ["ben", "biz", "sen"]], ["Choose the correct sentence.", "I like apples.", ["I likes apples.", "I liking apples.", "I are like apples."]],
  ];
  add(english, "Temel Dil Bilgisi", "english_grammar", grammar);
  const everyday = [
    ["‘Hello!’ sözüne uygun karşılık hangisidir?", "Hi!", ["Good night!", "Goodbye!", "Sorry!"]], ["‘How are you?’ sorusuna uygun cevap hangisidir?", "I’m fine, thank you.", ["My name is Ali.", "It is a pencil.", "Good night."]], ["‘What is your name?’ sorusu neyi sorar?", "Adını", ["Yaşını", "Rengini", "Saatini"]],
    ["‘How old are you?’ sorusu neyi sorar?", "Yaşını", ["Adını", "Nereli olduğunu", "En sevdiğin rengi"]], ["‘Goodbye!’ ne zaman söylenir?", "Ayrılırken", ["Tanışırken", "Yemek yerken", "Uyurken"]], ["‘I’m sorry’ ne demektir?", "Özür dilerim", ["Teşekkürler", "Günaydın", "Hoşça kal"]],
    ["‘Can I have some water, please?’ ne ister?", "Su", ["Kitap", "Kalem", "Elma"]], ["‘Where is the school?’ neyi sorar?", "Okulun yerini", ["Okulun yaşını", "Okulun rengini", "Okulun adını"]], ["‘I don’t understand’ ne demektir?", "Anlamıyorum", ["Bilmiyorum", "İstemiyorum", "Görmüyorum"]],
    ["‘Nice to meet you’ ne zaman söylenir?", "Tanışınca", ["Vedalaşırken", "Yemek isterken", "Özür dilerken"]], ["‘Thank you’ denince ne cevap verilebilir?", "You’re welcome.", ["Good night.", "I’m ten.", "It is blue."]], ["‘Open your book’ ne demektir?", "Kitabını aç", ["Kitabını kapat", "Ayağa kalk", "Dinle"]],
    ["‘Sit down, please’ ne demektir?", "Lütfen otur", ["Lütfen koş", "Lütfen dinle", "Lütfen yaz"]], ["‘Stand up’ ne demektir?", "Ayağa kalk", ["Otur", "Uyu", "Yüz"]], ["‘I like music’ ne demektir?", "Müziği severim", ["Müzik dinlemiyorum", "Müzik yapıyorum", "Müzik nerede?"]],
    ["‘What time is it?’ neyi sorar?", "Saati", ["Havayı", "Adı", "Yeri"]], ["‘It’s sunny’ ne demektir?", "Hava güneşli", ["Hava yağmurlu", "Hava soğuk", "Hava rüzgarlı"]], ["‘See you later’ ne demektir?", "Sonra görüşürüz", ["Günaydın", "Teşekkürler", "İyi geceler"]],
    ["‘May I come in?’ ne demektir?", "İçeri girebilir miyim?", ["Dışarı çıkabilir miyim?", "Yardım eder misin?", "Nasılsın?"]], ["‘Please repeat’ ne demektir?", "Lütfen tekrar et", ["Lütfen otur", "Lütfen yavaşla", "Lütfen gel"]],
  ];
  add(english, "Günlük İfadeler", "english_everyday", everyday);

  const science = "Fen Bilimleri";
  const living = [
    ["Bitkiler besin üretmek için en çok neye ihtiyaç duyar?", "Güneş ışığı", ["Plastik", "Cam", "Metal"]], ["Balıklar hangi ortamda yaşar?", "Suda", ["Çölde", "Ağaçta", "Toprak altında"]], ["İnsanlar nefes almak için ne kullanır?", "Akciğer", ["Mide", "Kemik", "Diş"]],
    ["Bitkinin toprağa tutunmasını hangi bölüm sağlar?", "Kök", ["Çiçek", "Yaprak", "Meyve"]], ["Kuşların uçmasına ne yardım eder?", "Kanatları", ["Yüzgeçleri", "Kökleri", "Boynuzları"]], ["Aşağıdakilerden hangisi canlıdır?", "Kelebek", ["Taş", "Masa", "Bardak"]],
    ["Bitkinin suyu aldığı bölüm hangisidir?", "Kök", ["Çiçek", "Meyve", "Tohum"]], ["İskeletimizin görevi nedir?", "Vücudumuza destek olmak", ["Yemekleri sindirmek", "Kanı pompalamak", "Nefes almak"]], ["Kalbimiz ne yapar?", "Kanı pompalar", ["Yemeği öğütür", "Duyar", "Görür"]],
    ["Arılar bitkilere nasıl yardım eder?", "Tozlaşmayı sağlar", ["Kökleri keser", "Güneşi kapatır", "Toprağı dondurur"]], ["Bir canlının büyüyüp değişmesine ne denir?", "Gelişme", ["Donma", "Erime", "Parlama"]], ["Aşağıdakilerden hangisi memelidir?", "Kedi", ["Kurbağa", "Balık", "Serçe"]],
    ["Kurbağa yaşamının ilk döneminde nasıl yaşar?", "Suda", ["Yalnızca havada", "Buz altında", "Ağaçta"]], ["Dişlerimizi sağlıklı tutmak için ne yapmalıyız?", "Düzenli fırçalamalıyız", ["Şeker yemeliyiz", "Hiç su içmemeliyiz", "Fırçalamamalıyız"]], ["Aşağıdakilerden hangisi duyu organıdır?", "Göz", ["Kalp", "Mide", "Kemik"]],
    ["Bitkinin tohum oluşan bölümü genellikle hangisidir?", "Çiçek", ["Kök", "Gövde", "Diken"]], ["İnsanlar hangi canlı grubundadır?", "Memeliler", ["Balıklar", "Bitkiler", "Mantarlar"]], ["Aşağıdakilerden hangisi sağlıklı bir alışkanlıktır?", "Dengeli beslenmek", ["Hep hareketsiz kalmak", "Az uyumak", "Ellerini yıkamamak"]],
    ["Bir bitkinin gövdesi ne işe yarar?", "Bitkiyi dik tutar", ["Işık üretir", "Toprağı yer", "Uçar"]], ["Aşağıdakilerden hangisi çevreyi korur?", "Atıkları geri dönüştürmek", ["Çöpleri yere atmak", "Suyu boşa akıtmak", "Ağaçları kırmak"]],
  ];
  add(science, "Canlılar Dünyası", "science_living", living);
  const matter = [
    ["Buz hangi hâldeki sudur?", "Katı", ["Sıvı", "Gaz", "Işık"]], ["Su kaynayınca hangi hâle dönüşür?", "Gaz", ["Katı", "Taş", "Metal"]], ["Süt hangi maddenin hâline örnektir?", "Sıvı", ["Katı", "Gaz", "Işık"]],
    ["Taş hangi hâldedir?", "Katı", ["Sıvı", "Gaz", "Buhar"]], ["Hava hangi hâldeki maddeye örnektir?", "Gaz", ["Katı", "Sıvı", "Taş"]], ["Suyun donmasıyla ne oluşur?", "Buz", ["Buhar", "Yağmur", "Kum"]],
    ["Katı maddelerin belirli bir şekli var mıdır?", "Evet", ["Hayır", "Yalnızca ısıtılınca", "Yalnızca suda"]], ["Sıvılar bulundukları kabın şeklini alır mı?", "Evet", ["Hayır", "Yalnızca donar", "Yalnızca parlar"]], ["Buhar hangi hâldedir?", "Gaz", ["Katı", "Sıvı", "Toprak"]],
    ["Buz ısınınca ne olur?", "Erir", ["Donar", "Küçülür ve taş olur", "Yanıp ışık verir"]], ["Su soğuyup donarsa hangi hâle geçer?", "Katı", ["Gaz", "Sıvı", "Işık"]], ["Aşağıdakilerden hangisi sıvıdır?", "Zeytinyağı", ["Tahta", "Hava", "Demir"]],
    ["Aşağıdakilerden hangisi gazdır?", "Hava", ["Buz", "Süt", "Taş"]], ["Aşağıdakilerden hangisi katıdır?", "Kalem", ["Su", "Hava", "Buhar"]], ["Maddenin ölçülebilen özelliklerinden biri hangisidir?", "Kütle", ["Renkli düşünce", "Sesli harf", "Yön adı"]],
    ["Mıknatıs hangi maddeyi çekebilir?", "Demir", ["Tahta", "Plastik", "Kâğıt"]], ["Işığı geçirmeyen maddeye ne denir?", "Opak", ["Saydam", "Esnek", "Sıvı"]], ["Cam genellikle ışığı nasıl geçirir?", "Saydamdır", ["Opak", "Gazdır", "Manyetiktir"]],
    ["Sünger için hangi özellik söylenebilir?", "Esnektir", ["Her zaman gazdır", "Işığı üretir", "Mıknatısla yapılır"]], ["Bir maddenin ısı alarak katıdan sıvıya geçmesine ne denir?", "Erime", ["Donma", "Yoğuşma", "Kırılma"]],
  ];
  add(science, "Madde ve Özellikleri", "science_matter", matter);
  const space = [
    ["Dünya'nın doğal uydusu hangisidir?", "Ay", ["Mars", "Güneş", "Venüs"]], ["Gündüz aydınlığını sağlayan yıldız hangisidir?", "Güneş", ["Ay", "Mars", "Dünya"]], ["Üzerinde yaşadığımız gezegen hangisidir?", "Dünya", ["Jüpiter", "Ay", "Güneş"]],
    ["Güneş bir yıldız mıdır?", "Evet", ["Hayır, gezegendir", "Hayır, uydudur", "Hayır, buluttur"]], ["Gece gökyüzünde gördüğümüz küçük ışıklı noktalar çoğunlukla nedir?", "Yıldızlar", ["Dağlar", "Denizler", "Ağaçlar"]], ["Dünya kendi çevresinde dönünce ne oluşur?", "Gece ve gündüz", ["Mevsimler hiç değişmez", "Ay yok olur", "Yağmur durur"]],
    ["Güneş'e en yakın gezegen hangisidir?", "Merkür", ["Dünya", "Mars", "Neptün"]], ["Kızıl Gezegen olarak bilinen gezegen hangisidir?", "Mars", ["Venüs", "Satürn", "Dünya"]], ["Halkalarıyla tanınan gezegen hangisidir?", "Satürn", ["Merkür", "Dünya", "Mars"]],
    ["Ay kendi ışığını üretir mi?", "Hayır, Güneş ışığını yansıtır", ["Evet, yıldızdır", "Hayır, ışığı tamamen yoktur", "Evet, ateştir"]], ["Dünya'nın şekli neye benzer?", "Küreye", ["Küp", "Koni", "Düz kareye"]], ["Güneş sisteminin merkezinde ne bulunur?", "Güneş", ["Dünya", "Ay", "Mars"]],
    ["Astronotlar uzayda ne giyer?", "Uzay giysisi", ["Yağmurluk", "Yüzme paleti", "Okul önlüğü"]], ["Hava olaylarını inceleyen bilim dalı hangisidir?", "Meteoroloji", ["Botanik", "Müzik", "Geometri"]], ["Yağmur, kar ve rüzgâr hangi konuyla ilgilidir?", "Hava olayları", ["Madenler", "Gezegenlerin şekli", "Sesler"]],
    ["Dünya'nın Güneş çevresindeki hareketi yaklaşık ne kadar sürer?", "Bir yıl", ["Bir gün", "Bir saat", "Bir hafta"]], ["Dünya'nın kendi ekseni çevresindeki dönüşü yaklaşık ne kadar sürer?", "Bir gün", ["Bir yıl", "Bir ay", "Bir mevsim"]], ["Ay Dünya'nın çevresinde dolanır mı?", "Evet", ["Hayır, Güneş'in çevresinde dolanmaz", "Ay bir yıldızdır", "Ay Dünya'dan büyüktür"]],
    ["Güneş ışığı Dünya'ya ne sağlar?", "Işık ve ısı", ["Yalnızca karanlık", "Taş ve toprak", "Rüzgârı durdurma"]], ["Aşağıdakilerden hangisi gezegendir?", "Jüpiter", ["Kutup Yıldızı", "Güneş", "Ay"]],
  ];
  add(science, "Dünya ve Uzay", "science_space", space);

  const social = "Sosyal Bilgiler";
  const directions = [
    ["Haritalarda yukarı taraf genellikle hangi yönü gösterir?", "Kuzey", ["Güney", "Doğu", "Batı"]],
    ["Haritalarda sağ taraf genellikle hangi yönü gösterir?", "Doğu", ["Batı", "Kuzey", "Güney"]],
    ["Haritalarda sol taraf genellikle hangi yönü gösterir?", "Batı", ["Doğu", "Güney", "Kuzey"]],
    ["Haritalarda aşağı taraf genellikle hangi yönü gösterir?", "Güney", ["Kuzey", "Doğu", "Batı"]],
    ["Güneş sabah hangi yönden doğar?", "Doğu", ["Batı", "Kuzey", "Güney"]],
    ["Güneş akşam hangi yönde batar?", "Batı", ["Doğu", "Kuzey", "Güney"]],
    ["Kuzey ile güney arasında kalan ana yön hangisidir?", "Doğu", ["Batı", "Kuzey", "Güney"]],
    ["Doğu ile batı arasında kalan ana yön hangisidir?", "Kuzey", ["Güney", "Doğu", "Batı"]],
    ["Bir haritanın neyi gösterdiğini açıklayan bölüme ne denir?", "Harita başlığı", ["Ölçek çizgisi", "Sınır taşı", "Yön oku"]],
    ["Haritadaki sembollerin anlamını nereden öğreniriz?", "Lejanttan", ["Başlıktan", "Kenarlıktan", "Cetvelden"]],
    ["Haritada uzaklıkları küçülterek gösteren oran nedir?", "Ölçek", ["Lejant", "Yön", "Başlık"]],
    ["Haritada kullanılan küçük resim ve işaretlere ne denir?", "Sembol", ["Ölçek", "Kıta", "İklim"]],
    ["Bir yerin kuş bakışı çizimine ne denebilir?", "Kroki", ["Takvim", "Grafik", "Mektup"]],
    ["Okulumuzun sınıflarını gösteren basit çizim hangisidir?", "Kroki", ["Dünya haritası", "Takvim", "Sözlük"]],
    ["Pusula en çok hangi amaçla kullanılır?", "Yön bulmak", ["Zaman ölçmek", "Ağırlık ölçmek", "Sıcaklık ölçmek"]],
    ["Pusulanın renkli ucu genellikle hangi yönü gösterir?", "Kuzey", ["Güney", "Doğu", "Batı"]],
    ["Dört ana yön hangileridir?", "Kuzey, güney, doğu, batı", ["Yukarı, aşağı, sağ, sol", "İlkbahar, yaz, sonbahar, kış", "Sabah, öğle, akşam, gece"]],
    ["Kuzeydoğu hangi iki ana yönün arasındadır?", "Kuzey ile doğu", ["Kuzey ile batı", "Güney ile doğu", "Güney ile batı"]],
    ["Güneybatı hangi iki ana yönün arasındadır?", "Güney ile batı", ["Kuzey ile doğu", "Kuzey ile batı", "Güney ile doğu"]],
    ["Bir şehir haritası en çok neyi bulmamıza yardım eder?", "Şehirdeki yerleri", ["Gezegenlerin yaşını", "Denizlerin derinliğini", "Saatin kaç olduğunu"]],
  ];
  add(social, "Harita ve Yönler", "social_directions", directions);

  const country = [
    ["Türkiye'nin başkenti neresidir?", "Ankara", ["İstanbul", "İzmir", "Bursa"]],
    ["Türkiye hangi kıtalar üzerinde topraklara sahiptir?", "Asya ve Avrupa", ["Afrika ve Amerika", "Avrupa ve Avustralya", "Asya ve Antarktika"]],
    ["Türkiye'nin bayrağında hangi şekiller bulunur?", "Ay ve yıldız", ["Güneş ve bulut", "Üç yıldız", "Dağ ve nehir"]],
    ["Türkiye Cumhuriyeti hangi tarihte ilan edilmiştir?", "29 Ekim 1923", ["23 Nisan 1920", "19 Mayıs 1919", "30 Ağustos 1922"]],
    ["Ulusal Egemenlik ve Çocuk Bayramı hangi gündür?", "23 Nisan", ["29 Ekim", "19 Mayıs", "30 Ağustos"]],
    ["Atatürk'ü Anma, Gençlik ve Spor Bayramı hangi gündür?", "19 Mayıs", ["23 Nisan", "29 Ekim", "10 Kasım"]],
    ["Zafer Bayramı hangi tarihte kutlanır?", "30 Ağustos", ["29 Ekim", "23 Nisan", "19 Mayıs"]],
    ["Türkiye'nin resmî dili hangisidir?", "Türkçe", ["İngilizce", "Fransızca", "Almanca"]],
    ["Türkiye'de kullanılan para birimi hangisidir?", "Türk lirası", ["Euro", "Dolar", "Sterlin"]],
    ["Türkiye'nin en kalabalık şehirlerinden biri hangisidir?", "İstanbul", ["Kars", "Sinop", "Artvin"]],
    ["Türkiye'nin çevresinde hangi deniz bulunmaz?", "Baltık Denizi", ["Karadeniz", "Ege Denizi", "Akdeniz"]],
    ["Türkiye'nin kuzeyinde hangi deniz vardır?", "Karadeniz", ["Akdeniz", "Kızıldeniz", "Baltık Denizi"]],
    ["Türkiye'nin batısında hangi deniz bulunur?", "Ege Denizi", ["Karadeniz", "Hazar Denizi", "Kızıldeniz"]],
    ["Türkiye'nin güneyinde hangi deniz bulunur?", "Akdeniz", ["Karadeniz", "Baltık Denizi", "Kuzey Denizi"]],
    ["Türkiye'nin yönetim şekli nedir?", "Cumhuriyet", ["Krallık", "İmparatorluk", "Dükalık"]],
    ["Cumhuriyet yönetiminde ülkeyi yönetme yetkisi kime aittir?", "Millete", ["Yalnızca bir aileye", "Yabancı ülkelere", "Bir şirkete"]],
    ["Türkiye Büyük Millet Meclisi hangi şehirde bulunur?", "Ankara", ["Antalya", "Edirne", "Trabzon"]],
    ["İstiklal Marşı'mızın yazarı kimdir?", "Mehmet Âkif Ersoy", ["Yunus Emre", "Namık Kemal", "Âşık Veysel"]],
    ["İstiklal Marşı okunurken nasıl davranmak uygundur?", "Saygıyla dinlemek", ["Yüksek sesle konuşmak", "Oyun oynamak", "Sınıfta dolaşmak"]],
    ["Ülkemizin ortak değerlerine nasıl katkı sağlayabiliriz?", "Onlara saygı göstererek", ["Tarihi eserleri bozarak", "Çevreyi kirleterek", "Kuralları önemsemeyerek"]],
  ];
  add(social, "Ülkemizi Tanıyalım", "social_country", country);

  window.LOCAL_QUESTION_BANK = bank;
})();
