# Arc42 Dokumentation: The Weather Archive

**Version:** 1.0
**Datum:** Januar 2026
**Autor:** Direncan Sahin

---

## Inhaltsverzeichnis

1. [Einführung und Ziele](#1-einführung-und-ziele)
2. [Randbedingungen](#2-randbedingungen)
3. [Kontextabgrenzung](#3-kontextabgrenzung)
4. [Lösungsstrategie](#4-lösungsstrategie)
5. [Bausteinsicht](#5-bausteinsicht)
6. [Laufzeitsicht](#6-laufzeitsicht)
7. [Verteilungssicht](#7-verteilungssicht)
8. [Querschnittliche Konzepte](#8-querschnittliche-konzepte)
9. [Architekturentscheidungen](#9-architekturentscheidungen)
10. [Qualitätsanforderungen](#10-qualitätsanforderungen)
11. [Risiken und technische Schulden](#11-risiken-und-technische-schulden)
12. [Glossar](#12-glossar)

---

## 1. Einführung und Ziele

### 1.1 Aufgabenstellung

"The Weather Archive" ist eine serverlose Webanwendung zur Archivierung und Visualisierung von Wetterdaten und Webcam-Bildern aus verschiedenen Städten weltweit. Die Anwendung ermöglicht:

- **Webcam-Integration**: Webcams können Bilder und Wetterdaten über eine REST-API hochladen
- **Automatische Bildverarbeitung**: Hochgeladene Bilder werden automatisch komprimiert und optimiert
- **Timelapse-Video-Generierung**: Aus den Bildern werden automatisch Timelapse-Videos erstellt
- **Datenvisualisierung**: Wetterdaten (Temperatur, Luftfeuchtigkeit, Luftdruck) werden als interaktive Grafiken dargestellt

### 1.2 Qualitätsziele

| Priorität | Qualitätsziel | Beschreibung |
|-----------|---------------|--------------|
| 1 | Skalierbarkeit | Die Anwendung soll automatisch mit der Last skalieren |
| 2 | Verfügbarkeit | 99.9% Verfügbarkeit durch AWS-Managed-Services |
| 3 | Kosteneffizienz | Pay-per-use Modell durch serverlose Architektur |
| 4 | Wartbarkeit | Modulare Microservice-Architektur |
| 5 | Sicherheit | API-Key-basierte Authentifizierung |

### 1.3 Stakeholder

| Rolle | Erwartung |
|-------|-----------|
| Endbenutzer | Einfache Suche nach Städten, Anzeige von Videos und Wettergrafiken |
| Webcam-Betreiber | Zuverlässige API zum Hochladen von Bildern und Wetterdaten |
| Entwickler | Gut dokumentierte, wartbare Codebasis |
| Betreiber | Geringe Betriebskosten, automatische Skalierung |

---

## 2. Randbedingungen

### 2.1 Technische Randbedingungen

| Randbedingung | Beschreibung |
|---------------|--------------|
| Cloud-Plattform | AWS (Amazon Web Services) |
| Architektur | Serverless (keine eigenen Server) |
| Programmiersprache | JavaScript/Node.js |
| Datenbank | PostgreSQL (AWS RDS) |
| Cache | Redis (AWS ElastiCache) |
| Objektspeicher | AWS S3 |
| API Gateway | AWS API Gateway (HTTP API) |

### 2.2 Organisatorische Randbedingungen

| Randbedingung | Beschreibung |
|---------------|--------------|
| Zeitrahmen | Semesterprojekt WS2025 |
| Team | Einzelprojekt |
| Budget | AWS Free Tier + minimale Kosten |

### 2.3 Konventionen

- RESTful API Design
- JSON als Datenformat
- Base64-Kodierung für Bildübertragung
- ISO 8601 für Zeitstempel

---

## 3. Kontextabgrenzung

### 3.1 Fachlicher Kontext

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE WEATHER ARCHIVE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐                              ┌──────────────┐     │
│  │ Webcams  │ ──POST /photo, /weather───▶  │   Backend    │     │
│  │ (IoT)    │ ◀────── Response ──────────  │   (Lambda)   │     │
│  └──────────┘                              └──────────────┘     │
│                                                   │             │
│                                                   ▼             │
│  ┌──────────┐                              ┌──────────────┐     │
│  │ Browser  │ ◀───GET /cities, /videos───  │   Frontend   │     │
│  │ (User)   │ ──────── Request ─────────▶  │   (S3)       │     │
│  └──────────┘                              └──────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Technischer Kontext

| Schnittstelle | Technologie | Beschreibung |
|---------------|-------------|--------------|
| Webcam API | HTTPS/REST | POST-Endpunkte für Bild- und Wetterdaten-Upload |
| Public API | HTTPS/REST | GET-Endpunkte für Datenabfrage |
| Frontend | HTTPS | Statische Website auf S3 |
| Datenbank | PostgreSQL | Persistente Datenspeicherung |
| Cache | Redis | In-Memory-Caching |
| Storage | S3 | Bild- und Videospeicherung |

---

## 4. Lösungsstrategie

### 4.1 Technologieentscheidungen

| Entscheidung | Begründung |
|--------------|------------|
| AWS Lambda | Serverless, automatische Skalierung, Pay-per-use |
| API Gateway | Managed API-Verwaltung, integrierte Sicherheit |
| S3 | Kostengünstiger Objektspeicher, hohe Verfügbarkeit |
| RDS PostgreSQL | Relationale Datenbank für strukturierte Daten |
| ElastiCache Redis | Schnelles Caching, reduziert DB-Last |
| EventBridge | Zeitgesteuerte Ausführung von Lambda-Funktionen |

### 4.2 Architekturansatz

Die Anwendung folgt einer **ereignisgesteuerten Microservice-Architektur**:

1. **API-First**: Alle Operationen erfolgen über REST-APIs
2. **Event-Driven**: S3-Events triggern Bildverarbeitung
3. **Scheduled Jobs**: EventBridge triggert Video-Generierung
4. **Caching**: Redis reduziert Datenbankzugriffe

### 4.3 Entwurfsprinzipien

- **Single Responsibility**: Jede Lambda-Funktion hat eine Aufgabe
- **Loose Coupling**: Services kommunizieren nur über APIs/Events
- **Stateless**: Lambda-Funktionen speichern keinen Zustand
- **Idempotenz**: Wiederholte Aufrufe führen zum gleichen Ergebnis

---

## 5. Bausteinsicht

### 5.1 Ebene 1: Gesamtsystem

```
┌─────────────────────────────────────────────────────────────────────┐
│                         THE WEATHER ARCHIVE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │   Frontend  │  │  Webcams    │  │   Picture   │  │   Video    │  │
│  │   (S3)      │  │   Lambda    │  │   Lambda    │  │   Lambda   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │
│         │                │                │               │         │
│         │                │                │               │         │
│         ▼                ▼                ▼               ▼         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │  API Lambda │  │     S3      │  │         PostgreSQL          │  │
│  │  (Public)   │  │   Bucket    │  │          (RDS)              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │
│         │                                        ▲                  │
│         ▼                                        │                  │
│  ┌─────────────┐                                 │                  │
│  │    Redis    │─────────────────────────────────┘                  │
│  │ ElastiCache │                                                    │
│  └─────────────┘                                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Ebene 2: Bausteine

#### 5.2.1 Frontend (S3 Static Website)

| Datei | Beschreibung |
|-------|--------------|
| `index.html` | Hauptseite mit Views (Home, Topic, Upload) |
| `app.js` | Anwendungslogik, API-Clients, Chart-Rendering |
| `config.js` | API-Endpunkt-Konfiguration |
| `style.css` | Styling |

**Funktionen:**
- Städtesuche mit Autocomplete
- Video-Anzeige
- Wetterdaten-Grafiken (Chart.js)
- Upload-Formular für Webcams

#### 5.2.2 API Lambda (courseproject-api)

**Endpunkte:**

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | /cities | Städte suchen |
| GET | /photos | Fotos abrufen |
| GET | /videos | Videos abrufen |
| GET | /weather | Wetterdaten abrufen |

**Caching-Strategie:**
- Cache-Key: `{endpoint}:{city_id}:{start_date}:{end_date}`
- TTL: 3600 Sekunden (1 Stunde)
- Header: `x-cache: HIT/MISS`

#### 5.2.3 Webcams Lambda (courseproject-webcams)

**Endpunkte:**

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| POST | /photo | Bild hochladen |
| POST | /weather | Wetterdaten hochladen |

**Sicherheit:**
- API-Key-Authentifizierung über `x-api-key` Header
- Validierung gegen `api_keys` Tabelle

#### 5.2.4 Picture Lambda (courseproject-picturelambda)

**Trigger:** S3 ObjectCreated Event (photos/ Prefix)

**Verarbeitung:**
1. Originalbild von S3 herunterladen
2. Mit Sharp resizen (max 800x600)
3. JPEG-Qualität auf 80% setzen
4. In processed/ Ordner speichern
5. Datenbank aktualisieren (is_processed = true)

#### 5.2.5 Video Lambda (courseproject-videolambda)

**Trigger:** EventBridge Schedule (alle 60 Minuten)

**Verarbeitung:**
1. Verarbeitete Bilder der letzten 60 Minuten abrufen
2. Nach Stadt gruppieren
3. FFmpeg: Timelapse-Video erstellen (15 Sek, 3 Sek/Bild)
4. Video in videos/ Ordner speichern
5. Datenbank aktualisieren (in_video = true)

### 5.3 Datenmodell

```sql
-- Städte
CREATE TABLE cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100)
);

-- API-Schlüssel
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    description VARCHAR(255)
);

-- Webcams
CREATE TABLE webcams (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id),
    api_key_id INTEGER REFERENCES api_keys(id),
    name VARCHAR(100)
);

-- Fotos
CREATE TABLE photos (
    id SERIAL PRIMARY KEY,
    webcam_id INTEGER REFERENCES webcams(id),
    city_id INTEGER REFERENCES cities(id),
    image_url TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    metadata JSONB,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    is_processed BOOLEAN DEFAULT FALSE,
    is_failed BOOLEAN DEFAULT FALSE,
    in_video BOOLEAN DEFAULT FALSE
);

-- Videos
CREATE TABLE videos (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id),
    time_range_start TIMESTAMP,
    time_range_end TIMESTAMP,
    video_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Wetterdaten
CREATE TABLE weather_data (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id),
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    pressure DECIMAL(7,2),
    timestamp TIMESTAMP DEFAULT NOW()
);
```

---

## 6. Laufzeitsicht

### 6.1 Szenario: Foto-Upload und Verarbeitung

```
Webcam          Webcams-Lambda       S3              Picture-Lambda       DB
  │                   │               │                    │               │
  │ POST /photo       │               │                    │               │
  │──────────────────▶│               │                    │               │
  │                   │ PutObject     │                    │               │
  │                   │──────────────▶│                    │               │
  │                   │               │ S3 Event           │               │
  │                   │               │───────────────────▶│               │
  │                   │ INSERT photo  │                    │               │
  │                   │───────────────┼────────────────────┼──────────────▶│
  │                   │               │                    │ GetObject     │
  │                   │               │◀───────────────────│               │
  │                   │               │                    │ Resize        │
  │                   │               │                    │ (Sharp)       │
  │                   │               │ PutObject          │               │
  │                   │               │◀───────────────────│               │
  │                   │               │                    │ UPDATE        │
  │                   │               │                    │──────────────▶│
  │ 200 OK            │               │                    │               │
  │◀──────────────────│               │                    │               │
```

### 6.2 Szenario: Video-Generierung

```
EventBridge     Video-Lambda         DB              S3
     │               │                │               │
     │ Trigger       │                │               │
     │──────────────▶│                │               │
     │               │ SELECT photos  │               │
     │               │───────────────▶│               │
     │               │                │               │
     │               │ photos[]       │               │
     │               │◀───────────────│               │
     │               │                │               │
     │               │ GetObject (x5) │               │
     │               │────────────────┼──────────────▶│
     │               │                │               │
     │               │ FFmpeg         │               │
     │               │ (create video) │               │
     │               │                │               │
     │               │ PutObject      │               │
     │               │────────────────┼──────────────▶│
     │               │                │               │
     │               │ INSERT video   │               │
     │               │───────────────▶│               │
     │               │                │               │
     │               │ UPDATE photos  │               │
     │               │───────────────▶│               │
```

### 6.3 Szenario: Datenabfrage mit Cache

```
Browser         API-Lambda          Redis           DB
   │                 │                │              │
   │ GET /weather    │                │              │
   │────────────────▶│                │              │
   │                 │ GET cache      │              │
   │                 │───────────────▶│              │
   │                 │                │              │
   │                 │ null (MISS)    │              │
   │                 │◀───────────────│              │
   │                 │                │              │
   │                 │ SELECT         │              │
   │                 │────────────────┼─────────────▶│
   │                 │                │              │
   │                 │ rows[]         │              │
   │                 │◀───────────────┼──────────────│
   │                 │                │              │
   │                 │ SET cache      │              │
   │                 │───────────────▶│              │
   │                 │                │              │
   │ 200 (x-cache:   │                │              │
   │      MISS)      │                │              │
   │◀────────────────│                │              │
   │                 │                │              │
   │ GET /weather    │                │              │
   │────────────────▶│                │              │
   │                 │ GET cache      │              │
   │                 │───────────────▶│              │
   │                 │                │              │
   │                 │ data (HIT)     │              │
   │                 │◀───────────────│              │
   │                 │                │              │
   │ 200 (x-cache:   │                │              │
   │      HIT)       │                │              │
   │◀────────────────│                │              │
```

---

## 7. Verteilungssicht

### 7.1 Infrastruktur

```
┌─────────────────────────────────────────────────────────────────────┐
│                            AWS Cloud                                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Region: us-east-1                       │   │
│  │                                                              │   │
│  │  ┌────────────┐    ┌────────────┐    ┌────────────────────┐  │   │
│  │  │    S3      │    │    S3      │    │   API Gateway      │  │   │
│  │  │ (Frontend) │    │ (Storage)  │    │   (HTTP API)       │  │   │
│  │  └────────────┘    └────────────┘    └────────────────────┘  │   │
│  │                          │                    │              │   │
│  │                          │                    │              │   │
│  │                          ▼                    ▼              │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │                  Lambda Functions                      │  │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │  │   │
│  │  │  │   API    │ │ Webcams  │ │ Picture  │ │  Video   │   │  │   │
│  │  │  │  Lambda  │ │  Lambda  │ │  Lambda  │ │  Lambda  │   │  │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │                          │                                   │   │
│  │           ┌──────────────┼──────────────┐                    │   │
│  │           ▼              ▼              ▼                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │   │
│  │  │    RDS      │  │ ElastiCache │  │ EventBridge │           │   │
│  │  │ PostgreSQL  │  │   Redis     │  │  Scheduler  │           │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 AWS-Ressourcen

| Ressource | Service | Konfiguration |
|-----------|---------|---------------|
| Frontend | S3 | Static Website Hosting, Public Access |
| Storage | S3 | photos/, processed/, videos/ Ordner |
| API Lambda | Lambda | Node.js 18, 128 MB RAM |
| Webcams Lambda | Lambda | Node.js 18, 128 MB RAM |
| Picture Lambda | Lambda | Node.js 18, 512 MB RAM, Sharp Layer |
| Video Lambda | Lambda | Node.js 18, 512 MB RAM, FFmpeg Layer |
| Datenbank | RDS | PostgreSQL, db.t3.micro |
| Cache | ElastiCache | Redis, cache.t3.micro |
| Scheduler | EventBridge | rate(60 minutes) |
| API | API Gateway | HTTP API, CORS enabled |

### 7.3 Netzwerkkonfiguration

- **VPC**: Lambda-Funktionen in privater VPC
- **Subnets**: Private Subnets für Lambda, RDS, ElastiCache
- **Security Groups**:
  - Lambda → RDS (Port 5432)
  - Lambda → Redis (Port 6379)
  - API Gateway → Lambda (HTTPS)

---

## 8. Querschnittliche Konzepte

### 8.1 Authentifizierung

```
┌─────────────────────────────────────────────────────────────┐
│                    API-Key-Authentifizierung                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Request:                                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ POST /photo                                         │    │
│  │ Headers:                                            │    │
│  │   x-api-key: APIKEY_VIENNA                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ SELECT * FROM webcams                               │    │
│  │ WHERE api_key_id = (                                │    │
│  │   SELECT id FROM api_keys WHERE api_key = $1        │    │
│  │ )                                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                  │
│              ┌───────────┴───────────┐                      │
│              ▼                       ▼                      │
│        ┌──────────┐           ┌──────────┐                  │
│        │ Gefunden │           │   Nicht  │                  │
│        │   200    │           │ Gefunden │                  │
│        └──────────┘           │   403    │                  │
│                               └──────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Caching-Strategie

| Aspekt | Implementierung |
|--------|-----------------|
| Cache-Typ | Read-Through Cache |
| Cache-Key | `{entity}:{city_id}:{start_date}:{end_date}` |
| TTL | 3600 Sekunden |
| Invalidierung | Automatisch nach TTL |
| Fallback | Bei Redis-Fehler direkt zur DB |

### 8.3 Fehlerbehandlung

| HTTP-Code | Bedeutung | Beispiel |
|-----------|-----------|----------|
| 200 | Erfolg | Daten erfolgreich abgerufen |
| 204 | Kein Inhalt | OPTIONS Preflight |
| 400 | Bad Request | Fehlende Parameter |
| 401 | Unauthorized | Fehlender API-Key |
| 403 | Forbidden | Ungültiger API-Key |
| 404 | Not Found | Route nicht gefunden |
| 500 | Server Error | Interner Fehler |

### 8.4 CORS-Konfiguration

```javascript
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,x-api-key",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Expose-Headers": "x-cache",
    "Access-Control-Max-Age": "86400"
};
```

### 8.5 Bildverarbeitung

| Parameter | Wert |
|-----------|------|
| Max. Breite | 800px |
| Max. Höhe | 600px |
| Format | JPEG |
| Qualität | 80% |
| Bibliothek | Sharp |

### 8.6 Videogenerierung

| Parameter | Wert |
|-----------|------|
| Auflösung | 1280x720 |
| Codec | H.264 (libx264) |
| Framerate | 30 fps |
| Dauer pro Bild | 3 Sekunden |
| Max. Bilder | 5 |
| Bibliothek | FFmpeg |

---

## 9. Architekturentscheidungen

### ADR-001: Serverless-Architektur

**Status:** Akzeptiert

**Kontext:** Die Anwendung soll kosteneffizient und skalierbar sein.

**Entscheidung:** Verwendung von AWS Lambda für alle Backend-Funktionen.

**Konsequenzen:**
- (+) Automatische Skalierung
- (+) Pay-per-use
- (+) Kein Server-Management
- (-) Cold-Start-Latenz
- (-) Max. 15 Minuten Ausführungszeit

### ADR-002: Event-Driven Bildverarbeitung

**Status:** Akzeptiert

**Kontext:** Bilder sollen automatisch nach dem Upload verarbeitet werden.

**Entscheidung:** S3-Event-Trigger löst Picture-Lambda aus.

**Konsequenzen:**
- (+) Asynchrone Verarbeitung
- (+) Entkopplung von Upload und Verarbeitung
- (+) Automatische Retry bei Fehlern
- (-) Komplexeres Debugging

### ADR-003: Redis-Caching

**Status:** Akzeptiert

**Kontext:** Wiederholte Datenbankabfragen sollen vermieden werden.

**Entscheidung:** ElastiCache Redis für Caching von API-Antworten.

**Konsequenzen:**
- (+) Reduzierte DB-Last
- (+) Schnellere Antwortzeiten
- (+) Skalierbarkeit
- (-) Zusätzliche Kosten
- (-) Cache-Invalidierung erforderlich

### ADR-004: Getrennte APIs

**Status:** Akzeptiert

**Kontext:** Lese- und Schreiboperationen haben unterschiedliche Anforderungen.

**Entscheidung:** Separate Lambda-Funktionen für Public API (Lesen) und Webcams API (Schreiben).

**Konsequenzen:**
- (+) Single Responsibility
- (+) Unabhängige Skalierung
- (+) Unterschiedliche Sicherheitsanforderungen
- (-) Mehr Lambda-Funktionen zu verwalten

---

## 10. Qualitätsanforderungen

### 10.1 Qualitätsbaum

```
                    Qualität
                       │
       ┌───────────────┼───────────────┐
       │               │               │
  Performance     Sicherheit      Wartbarkeit
       │               │               │
   ┌───┴───┐       ┌───┴───┐       ┌───┴───┐
   │       │       │       │       │       │
Latenz  Cache   API-Key  CORS   Modular  Logs
```

### 10.2 Qualitätsszenarien

| ID | Szenario | Metrik |
|----|----------|--------|
| QS-01 | API-Antwortzeit bei Cache-Hit | < 100ms |
| QS-02 | API-Antwortzeit bei Cache-Miss | < 500ms |
| QS-03 | Bildverarbeitung | < 5 Sekunden |
| QS-04 | Videogenerierung | < 60 Sekunden |
| QS-05 | Systemverfügbarkeit | > 99.9% |

---

## 11. Risiken und technische Schulden

### 11.1 Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Maßnahme |
|--------|-------------------|------------|----------|
| Cold-Start-Latenz | Mittel | Gering | Provisioned Concurrency |
| Redis-Ausfall | Gering | Mittel | Fallback zu DB |
| S3-Speicherkosten | Mittel | Gering | Lifecycle Policies |
| DDoS-Angriffe | Gering | Hoch | AWS WAF, Rate Limiting |

### 11.2 Technische Schulden

| Schuld | Priorität | Beschreibung |
|--------|-----------|--------------|
| Keine Tests | Hoch | Unit- und Integrationstests fehlen |
| Keine Monitoring | Mittel | CloudWatch-Dashboards einrichten |
| Cache-Invalidierung | Mittel | Manuelle Invalidierung bei Datenänderungen |
| API-Versionierung | Niedrig | Keine Versionierung implementiert |

---

## 12. Glossar

| Begriff | Definition |
|---------|------------|
| Lambda | AWS-Service für serverlose Funktionen |
| S3 | Simple Storage Service - AWS-Objektspeicher |
| RDS | Relational Database Service - AWS-Datenbank |
| ElastiCache | AWS-Managed-Caching-Service |
| API Gateway | AWS-Service für API-Management |
| EventBridge | AWS-Service für ereignisgesteuerte Architekturen |
| Sharp | Node.js-Bibliothek für Bildverarbeitung |
| FFmpeg | Multimedia-Framework für Video/Audio-Verarbeitung |
| Cold Start | Verzögerung beim ersten Aufruf einer Lambda-Funktion |
| TTL | Time To Live - Gültigkeitsdauer von Cache-Einträgen |
| CORS | Cross-Origin Resource Sharing |
| REST | Representational State Transfer - API-Architekturstil |
| Base64 | Kodierungsschema für Binärdaten als Text |

---

## Anhang

### A. API-Endpunkte

#### Public API (Lesen)
```
Base URL: https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com

GET /cities?search={query}
GET /photos?city_id={id}&start_date={date}&end_date={date}
GET /videos?city_id={id}&start_date={date}&end_date={date}
GET /weather?city_id={id}&start_date={date}&end_date={date}
```

#### Webcams API (Schreiben)
```
Base URL: https://34gvv02dj9.execute-api.us-east-1.amazonaws.com

POST /photo
Headers: x-api-key: {API_KEY}
Body: { "image": "base64...", "title": "...", "metadata": {} }

POST /weather
Headers: x-api-key: {API_KEY}
Body: { "temperature": 20.5, "humidity": 65, "pressure": 1013.25 }
```

### B. S3-Bucket-Struktur

```
weather-archive-project-direncan-sahin/
├── photos/           # Originale Webcam-Bilder
├── processed/        # Verarbeitete (resized) Bilder
└── videos/           # Generierte Timelapse-Videos
```

### C. Umgebungsvariablen

| Variable | Lambda | Beschreibung |
|----------|--------|--------------|
| DATABASE_URL | Alle | PostgreSQL-Verbindungsstring |
| REDIS_URL | API | Redis-Verbindungsstring |
| S3_BUCKET_NAME | Webcams, Video | S3-Bucket-Name |
| AWS_REGION | Alle | AWS-Region |
| ALLOWED_ORIGIN | Webcams | CORS-erlaubte Origin |

---

**Dokumentenende**
