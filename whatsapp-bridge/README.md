# Ponte WhatsApp → HostAgente (pagamentos M-Pesa / eMola)

Bot que fica ligado a um número de WhatsApp, lê os comprovantes de pagamento
(SMS do M-Pesa ou eMola reencaminhados pelo cliente), calcula quantos megas
correspondem ao valor pago e envia automaticamente para o endpoint
`/ingest/macrodroid` do HostAgente.

## O que ele faz

1. Recebe a mensagem no WhatsApp.
2. Espera alguns segundos (`bufferMs` no `config.json`) para juntar mensagens
   seguidas da mesma pessoa (o SMS e, à parte, o número que quer receber os megas).
3. Identifica se é M-Pesa ou eMola pelo formato do texto.
4. Extrai valor pago, referência da transação e o número do cliente:
   - Se houver um número moçambicano (9 dígitos, começa por 8) que não seja a
     tua conta, usa esse número; caso contrário usa o número de quem enviou.
5. Consulta a tabela de preços (`config.json`). Se o valor não estiver na tabela,
   não envia — avisa o cliente e envia-te o texto completo (`adminNumber`).
6. Envia ao endpoint com o header `x-api-key`.
7. Responde ao cliente a confirmar.
8. Guarda a referência em `processed.json` para não processar duas vezes.

## Instalação na VPS (Ubuntu/Debian)

```bash
cd whatsapp-bridge
npm install

cp .env.example .env
nano .env          # cola a tua chave hka_...

nano config.json   # ajusta endpoint, adminNumber, ownAccountNumbers e pricing

node index.js       # primeira vez: escaneia o QR code
```

WhatsApp no telemóvel → **Aparelhos conectados → Conectar aparelho** → escaneia.
A sessão fica guardada em `auth_info/` (não precisas escanear de novo).

## Correr como serviço (liga sempre, reinicia sozinho)

```bash
nano whatsapp-bridge.service           # ajusta User e WorkingDirectory
sudo cp whatsapp-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-bridge
sudo systemctl start whatsapp-bridge
sudo journalctl -u whatsapp-bridge -f  # logs em tempo real
```

## Editar a tabela de preços

Não precisas reiniciar — o `config.json` é recarregado a cada mensagem:

```json
"pricing": { "10": 100, "20": 250, "24": 300, "50": 600, "100": 1300, "180": 2400 }
```

Chave = valor pago em MT · valor = megas em MB.

## Notas

- Usa a biblioteca Baileys (liga-se como "dispositivo conectado", tal como o
  WhatsApp Web). Não é a API oficial — evita muitas mensagens automáticas por
  minuto para não levantar suspeita de spam.
- Usa um número dedicado só para isto.
- Referências repetidas são detetadas ("já foi processado").
- Valores fora da tabela ficam para confirmação manual e avisam o `adminNumber`.

> A tabela de preços aqui é para a **resposta ao cliente**. A entrega do pacote
> é decidida pelo HostAgente ao fazer *match* do valor com os teus **Pacotes**
> (Dashboard → Pacotes), por isso mantém os dois alinhados.
