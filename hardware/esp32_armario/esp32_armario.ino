// Firmware de partida para el Armario Inteligente.
// Librerías (Arduino IDE > Tools > Manage Libraries):
//   - "MFRC522" de GithubCommunity
//   - "Adafruit NeoPixel"
//   - "ArduinoJson" (v6 o v7)

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Adafruit_NeoPixel.h>
#include <ArduinoJson.h>

// ---------- Configuración: edita esto ----------
const char *WIFI_SSID = "tu_wifi";
const char *WIFI_PASSWORD = "tu_password";
const char *SERVER_URL = "http://192.168.1.100:8000";  // IP de tu laptop en la red local, o la URL de Render

const int CANTIDAD_LECTORES = 5;              // perchas reales que cableaste
const int PINES_CS[CANTIDAD_LECTORES] = {5, 17, 16, 4, 2};  // un pin CS distinto por lector
const int PIN_RST_COMPARTIDO = 22;            // los RC522 pueden compartir el mismo RST

const int PIN_DATA_TIRA = 27;                 // data de la tira WS2812B (perchas)
const int CANTIDAD_LEDS_TIRA = CANTIDAD_LECTORES + 2;  // margen para crecer

const int PIN_LED_CAJON = 26;                 // LED simple (no direccionable) para la gaveta

const unsigned long INTERVALO_POLL_LEDS_MS = 1500;
// -------------------------------------------------

MFRC522 lectores[CANTIDAD_LECTORES] = {
    MFRC522(PINES_CS[0], PIN_RST_COMPARTIDO),
    MFRC522(PINES_CS[1], PIN_RST_COMPARTIDO),
    MFRC522(PINES_CS[2], PIN_RST_COMPARTIDO),
    MFRC522(PINES_CS[3], PIN_RST_COMPARTIDO),
    MFRC522(PINES_CS[4], PIN_RST_COMPARTIDO),
};

String ultimoUidPorLector[CANTIDAD_LECTORES];

Adafruit_NeoPixel tira(CANTIDAD_LEDS_TIRA, PIN_DATA_TIRA, NEO_GRB + NEO_KHZ800);

unsigned long ultimoPollLeds = 0;

String zonaDeLector(int indiceLector) {
  // Debe coincidir con los ids generados por POST /zonas/generar-colgador
  return "percha_" + String(indiceLector);
}

String uidToString(MFRC522::Uid uid) {
  String resultado = "";
  for (byte i = 0; i < uid.size; i++) {
    if (uid.uidByte[i] < 0x10) resultado += "0";
    resultado += String(uid.uidByte[i], HEX);
  }
  resultado.toUpperCase();
  return resultado;
}

void conectarWifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando a WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println(" conectado, IP: " + WiFi.localIP().toString());
}

void enviarEventoNfc(const String &uid, const String &zona, const String &tipo) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(String(SERVER_URL) + "/eventos/nfc");
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["uid"] = uid;
  doc["zona"] = zona;
  doc["tipo"] = tipo;
  String cuerpo;
  serializeJson(doc, cuerpo);

  int codigo = http.POST(cuerpo);
  Serial.printf("NFC %s zona=%s uid=%s -> HTTP %d\n", tipo.c_str(), zona.c_str(), uid.c_str(), codigo);
  http.end();
}

void revisarLectores() {
  for (int i = 0; i < CANTIDAD_LECTORES; i++) {
    MFRC522 &lector = lectores[i];
    bool hayTarjeta = lector.PICC_IsNewCardPresent() && lector.PICC_ReadCardSerial();

    if (hayTarjeta) {
      String uid = uidToString(lector.uid);
      if (uid != ultimoUidPorLector[i]) {
        if (ultimoUidPorLector[i] != "") {
          enviarEventoNfc(ultimoUidPorLector[i], zonaDeLector(i), "perdido");
        }
        enviarEventoNfc(uid, zonaDeLector(i), "visto");
        ultimoUidPorLector[i] = uid;
      }
      lector.PICC_HaltA();
      lector.PCD_StopCrypto1();
    } else if (ultimoUidPorLector[i] != "") {
      // Nota: con lectura por acercamiento (no contacto fijo), esto puede marcar
      // "perdido" apenas se aleja un poco. Si molesta, agrega un pequeño debounce
      // (ej. solo marcar perdido tras N lecturas vacías seguidas).
      enviarEventoNfc(ultimoUidPorLector[i], zonaDeLector(i), "perdido");
      ultimoUidPorLector[i] = "";
    }
  }
}

void actualizarLeds() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(String(SERVER_URL) + "/leds/estado");
  int codigo = http.GET();
  if (codigo != 200) {
    http.end();
    return;
  }

  JsonDocument doc;
  deserializeJson(doc, http.getString());
  http.end();

  tira.clear();
  digitalWrite(PIN_LED_CAJON, LOW);

  for (JsonObject zona : doc["zonas_encendidas"].as<JsonArray>()) {
    String tipo = zona["tipo"].as<String>();
    if (tipo == "colgador") {
      int indice = zona["led_id"].as<int>();
      if (indice >= 0 && indice < CANTIDAD_LEDS_TIRA) {
        tira.setPixelColor(indice, tira.Color(255, 180, 60));  // ámbar cálido
      }
    } else if (tipo == "cajon") {
      digitalWrite(PIN_LED_CAJON, HIGH);
    }
  }
  tira.show();
}

void setup() {
  Serial.begin(115200);
  SPI.begin();
  for (int i = 0; i < CANTIDAD_LECTORES; i++) {
    lectores[i].PCD_Init();
  }

  pinMode(PIN_LED_CAJON, OUTPUT);
  tira.begin();
  tira.show();

  conectarWifi();
}

void loop() {
  revisarLectores();

  if (millis() - ultimoPollLeds > INTERVALO_POLL_LEDS_MS) {
    actualizarLeds();
    ultimoPollLeds = millis();
  }
}
