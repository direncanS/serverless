const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { Pool } = require("pg");
const sharp = require('sharp');
const path = require('path');

// S3 İstemcisi (v3)
const s3Client = new S3Client();

// Veritabanı Bağlantısı
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Yardımcı Fonksiyon: S3'ten gelen veri akışını (Stream) Buffer'a çevirir
const streamToBuffer = async (stream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
};

exports.handler = async (event) => {
    console.log('İşlenen olay:', JSON.stringify(event, null, 2));
    
    try {
        const record = event.Records[0];
        const sourceBucket = record.s3.bucket.name;
        // URL decoding ve boşluk düzeltme
        const sourceKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        
        // Sonsuz döngü koruması: Zaten processed klasöründeyse dur
        if (sourceKey.startsWith('processed/')) {
            console.log('Resim zaten işlenmiş, atlanıyor:', sourceKey);
            return { statusCode: 200, body: JSON.stringify({ message: 'Already processed' }) };
        }
        
        console.log(`İşlenecek resim: ${sourceBucket}/${sourceKey}`);
        
        // 1. Orijinal Resmi S3'ten İndir (v3)
        const getCommand = new GetObjectCommand({
            Bucket: sourceBucket,
            Key: sourceKey
        });
        const response = await s3Client.send(getCommand);
        
        // v3'te Body bir Stream'dir, onu Buffer'a çevirmeliyiz
        const imageData = await streamToBuffer(response.Body);
        
        // 2. Sharp ile Resmi İşle
        const imageInfo = await sharp(imageData).metadata();
        console.log('Orijinal Boyut:', imageInfo.width, 'x', imageInfo.height);

        const resizedImageBuffer = await sharp(imageData)
            .rotate() // Exif verisine göre düzelt
            .resize({
                width: 800,
                height: 600,
                fit: sharp.fit.inside,
                withoutEnlargement: true
            })
            .toFormat('jpeg', { quality: 80 })
            .toBuffer();
            
        // 3. İşlenen Resmi S3'e Yükle (processed klasörüne)
        const fileName = path.basename(sourceKey, path.extname(sourceKey));
        const destKey = `processed/${fileName}.jpg`;

        const putCommand = new PutObjectCommand({
            Bucket: sourceBucket,
            Key: destKey,
            Body: resizedImageBuffer,
            ContentType: 'image/jpeg'
        });
        
        await s3Client.send(putCommand);
        console.log(`Resim kaydedildi: ${destKey}`);

        // 4. Veritabanını Güncelle
        // Orijinal URL'i bul (webcams-lambda'nın kaydettiği formatta)
        const region = process.env.AWS_REGION || "eu-central-1";
        // webcams-lambda'da https://... kullanmıştık. Tam eşleşme için aynısını kuruyoruz.
        const originalImageUrl = `https://${sourceBucket}.s3.${region}.amazonaws.com/${sourceKey}`;
        const processedImageUrl = `https://${sourceBucket}.s3.${region}.amazonaws.com/${destKey}`;

        // Veritabanında güncelleme yap (image_url'i değiştirmiyoruz, belki yeni bir kolon olsa iyi olurdu ama 
        // senaryoda processed olanı kullanacaksak güncelleyebiliriz veya is_processed=true yapabiliriz)
        
        // Ödev mantığı genelde: is_processed = true yap şeklindedir.
        // Ama senin kodunda image_url update ediliyordu. İkisini de yapalım.
        
        const updateQuery = `
            UPDATE photos 
            SET is_processed = true, image_url = $1
            WHERE image_url = $2
            RETURNING id
        `;
        
        const client = await pool.connect();
        const result = await client.query(updateQuery, [processedImageUrl, originalImageUrl]);
        client.release();
        
        if (result.rowCount > 0) {
            console.log("Veritabanı güncellendi ID:", result.rows[0].id);
        } else {
            console.log("UYARI: Veritabanında eşleşen kayıt bulunamadı!", originalImageUrl);
        }

        return { statusCode: 200, body: JSON.stringify({ message: 'Success', newUrl: processedImageUrl }) };

    } catch (error) {
        console.error('Hata:', error);
        // Retry mekanizmasını tetiklememek için hatayı yutabilirsin ama development aşamasında fırlatmak iyidir
        return { statusCode: 500, error: error.message };
    }
};