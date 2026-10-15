# Dizilab Reverse Engineered API & Web Dashboard

 **Python harici web hostinglerinde (PHP veya Node.js)** sıfır yapılandırmayla çalışan tam teşekküllü Dizilab API servisi.

---

## 🌟 Özellikler

1. **Python Harici Web Hosting Desteği:**
   - **PHP Sürümü (`api.php`):** Standart cPanel / Paylaşımlı PHP hostinglerde doğrudan çalışır (cURL + JSON).
   - **Node.js Sürümü (`server.js`):** Express + Cheerio ile yüksek performanslı REST API sunucusu.
2. **Dinamik Domain Değiştirici (Domain Switcher):**
   - Dizilab'ın domaini (`.to`, `.pw`, `.net`, `.org`) değiştiğinde arayüzdeki textbox'tan veya API parametresinden anında değiştirilebilir.
3. **Hepsinin Çekildiği Canlı Sayfa (All-Shows Feed):**
   - Sitedeki tüm güncel dizileri afişleri ve detaylarıyla tek sayfada listeleyen görsel web paneli.
4. **HLS Master Stream (.m3u8) & Altyazı Deşifresi:**
   - Bölüm player'ındaki Ksdpictures / UXPlayer m3u8 playlistlerini ve VTT altyazılarını doğrudan çıkarır.

---

## 🚀 Hızlı Başlangıç

### Node.js İle Çalıştırma:
```bash
cd c:\Users\pc\Desktop\dizilab-api
npm install
node server.js
```
Tarayıcıdan **`http://localhost:5050`** adresine giderek canlı test paneline ve dökümantasyona erişebilirsiniz.

### PHP Web Hosting İle Çalıştırma:
`api.php` dosyasını hostinginizin `public_html` dizinine yükleyin:
```
https://siteniz.com/api.php?action=search&q=slow
```

---

## 📡 API Endpointleri

| Metot | Endpoint | Parametreler | Açıklama |
|---|---|---|---|
| `GET` | `/api/all` | `domain` *(opsiyonel)* | Sitedeki tüm dizileri afiş ve sluglarıyla listeler. |
| `GET` | `/api/search` | `q`, `domain` | Dizi adı araması yapar (`/wstream/v1/search`). |
| `GET` | `/api/show` | `slug`, `domain` | Dizi künyesi, afiş ve bölümleri döner. |
| `GET` | `/api/stream` | `url`, `domain` | Bölümün ham HLS `.m3u8` video akışını ve altyazılarını çözer. |
| `POST` | `/api/config` | `{ "domain": "https://..." }` | Aktif domaini kalıcı olarak günceller. |
