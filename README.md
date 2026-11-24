# MegaNature · Faroe Adaları — Kalsoy

Kallur Feneri yakınından başlayan, tarayıcıda yürünebilen tek bir 3B doğa haritası. Arazi, Copernicus DEM GLO-30 verisinden gerçek metre ölçeğinde üretilir. Kalsoy, Kunoy ve Eysturoy’un kuzeydoğu dağları aynı haritadadır.

**Canlı:** https://pandakingpunc.github.io/meganature/

## Yerel kullanım

Node.js 22 veya sonrası, npm ve WebGL 2 destekli bir tarayıcı gerekir. Tarayıcı doğrulaması kurulu Microsoft Edge’i kullanır.

```sh
npm ci
npm run build
npm run preview
```

Önizleme [127.0.0.1:4174](http://127.0.0.1:4174) adresinde açılır. Three.js ve harita verisi statik `dist/` çıktısına dahildir. `dist/` doğrudan statik site olarak sunulabilir.

| Kontrol | İşlev |
| --- | --- |
| **Keşfe başla** veya manzaraya tıkla | Fareyi kilitle ve bakışı yönet |
| **WASD** / ok tuşları | Yürü veya uçuş yönünü değiştir |
| **Shift** | Koş veya daha hızlı uç |
| **F** | Uçuşu aç veya kapat |
| **Q** / **E** | Uçuşta alçal / yüksel |
| **P** | Fotoğraf moduna gir veya çık |
| **Esc** | Fare kilidini aç |
| Dokunmatik | Sol sanal çubukla hareket et, manzarayı sürükleyerek bak. Uçuş ve fotoğraf için ekrandaki düğmeleri kullan. |

Yürüyüşte rakım zemin kotunu, uçuşta kamera kotunu gösterir. Deniz ya da çok dik zemin üzerindeyken uçuş kapatılırsa kamera son yürünebilir konuma döner.

## Harita ve veri

| WGS 84 sınırı | Ondalık derece |
| --- | ---: |
| Batı | −7,0215 |
| Güney | 62,236 |
| Doğu | −6,595916939652 |
| Kuzey | 62,4336 |

Kenar uzunluğu yaklaşık **21,97 km**. Kallur, Kalsoy ve Kunoy’un güney kıyılarını da içine alan karenin kuzey yarısındadır. Batı sınırı, Eysturoy’daki Slættaratindur’u kapsamak için −7°’nin batısına uzanır. Bu nedenle `N62 W007` ve `N62 W008` karoları birlikte kullanılır. Kallur modeli **62,3702208° K, 6,8115903° B** koordinatında yer alır. [Bölge tanımı](data/region.json), [OpenStreetMap Kallur düğümü](https://www.openstreetmap.org/node/719113406), [Slættaratindur koordinatı](https://en.wikipedia.org/wiki/Sl%C3%A6ttaratindur).

`height.bin` kuzeyden güneye satır sıralı, **769 × 769** örnekli, little-endian Uint16 desimetre ızgarasıdır. **28,610 m** örnek aralığı, **1.182.722 bayt** dosya boyutu ve **0–873,5 m** kot aralığı vardır. Betik kaynak pikselleri iki karodan okur, orta enlemin kosinüsüyle boylamı metreye dönüştürür ve ortak kare ızgaraya bilineer örnekler. 0 m ve altı deniz olarak kodlanır. Dikey ölçek 1:1’dir.

İşlenmiş harita depodadır. Veriyi yeniden üretmek için şu komutları çalıştırın. Ham GeoTIFF’ler `data/raw/` dizininde önbelleğe alınır. [Copernicus DEM AWS arşivi](https://registry.opendata.aws/copernicus-dem/).

```sh
npm run fetch:dem
npm run build:heightmap
npm run build
```

Arazi parçaları kameranın uzaklığına göre 1, 2, 4 veya 8 örnek adımında çizilir ve komşu kenarlar ortak örneklerde birleşir. Eğim, kaya ve çimen geçişini belirler. Çimen öbekleri ve 36 koyunun parçaları instancing ile çizilir. Su ve alçak sis animasyonludur. Kare hızı düştüğünde uygulama çizim çözünürlüğünü azaltır.

## Doğrulama

```sh
npm run build
npm test
```

Playwright, kurulu Edge’in headless kanalında statik çıktıyı açar. Canvas piksellerini, konsolu, yürüyüşü, fare kilidini, uçuşu ve fotoğraf modunu denetler. Dokunmatik kontroller Edge’in dokunmatik emülasyonunda sınanır. İki kare [açılış](tests/shots/01-kallur.png) ve [uçuş](tests/shots/02-ucus.png) görünümlerini kaydeder.

| Konum | Noktadaki DEM | Yakın çevredeki maksimum | Yayımlanan kot |
| --- | ---: | ---: | ---: |
| Slættaratindur, Eysturoy | 873,2 m | 873,2 m / 60 m | 880 m |
| Kúvingafjall, Kunoy | 769,3 m | 812,0 m / 150 m | 830 m |
| Nestindar, Kalsoy | 730,8 m | 732,3 m / 60 m | 788 m |
| Sandfelli (Gjógv), Eysturoy | 741,7 m | 743,2 m / 60 m | 752 m |

Izgaranın **873,5 m** maksimumu 62,296721° K, 7,013188° B’de, Slættaratindur’un yayımlanan GPS noktasının 1 m yakınındadır. Nestindar’da yerel fark yaklaşık 56 m’ye çıkar. Yayımlanan zirve kotları ve GPS tablosu Umhvørvisstovan’dan, Kúvingafjall konumu OpenStreetMap’ten alındı. [Umhvørvisstovan zirve tablosu ve GPS verisi](https://www.us.fo/vitanargrunnur/fjallatoppar/), [OpenStreetMap Kúvingafjall düğümü](https://www.openstreetmap.org/node/302104831).

Fenerin koordinatında DEM zemini **184,7 m**, yayımlanan ışık odak kotu **240 m**. Denizden yükselen burunla uyumlu bir zemin kotu elde edilse de **55,3 m** farkın yalnız bir kısmı ışığın bina üzerindeki yüksekliğiyle açıklanabilir. Dar uçurum sırtı, kullanılan DEM ölçeğinde yumuşar. Model aynı enlem ve boylamda, kendi taban alanına uyan küçük bir temel üzerine oturur. [OpenStreetMap fener kaydı](https://www.openstreetmap.org/node/719113406), [Kallur feneri ve odak yüksekliği](https://www.ibiblio.org/lighthouse/fro.htm).

## Kaynaklar ve lisans

Copernicus DEM GLO-30, © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA.

Bu harita Copernicus WorldDEM-30 verisinden üretilmiştir. Tüm hakları saklıdır. Copernicus programından kanunen veya yetki devriyle sorumlu kuruluşlar, Copernicus WorldDEM-30’un kullanımından dolayı sorumluluk taşımaz. [Copernicus DEM GLO-30 lisansı](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf).

Fener koordinatı © OpenStreetMap katkıcıları. Uygulama kodunun ve üçüncü taraf bileşenlerinin lisansları ayrı dosyalardadır. [OpenStreetMap telif bilgisi](https://www.openstreetmap.org/copyright), [MIT](LICENSE), [Üçüncü taraf lisansları](THIRD_PARTY_LICENSES.txt).
