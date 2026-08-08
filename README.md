# Mini Digital Signage MVP - iPad Mini 3

Este é um MVP (Minimum Viable Product) de um sistema de sinalização digital remota, projetado especificamente para rodar de forma leve e estável em dispositivos legados, com foco prioritário no **iPad Mini 3 (Safari / iOS 12.5.7)**.

O objetivo do MVP é validar a viabilidade técnica de controlar remotamente (via celular) a imagem ou vídeo reproduzido em tela cheia no iPad, utilizando apenas tecnologias web simples e robustas.

---

## 📱 Visão Geral da Arquitetura

O sistema é construído sobre uma arquitetura minimalista de cliente-servidor sem dependência de bundlers complexos ou WebSockets (que geram erros em navegadores antigos):

```
       [ Celular (Admin) ]
               │
               ▼ (HTTP POST /api/select-media)
        [ Servidor Node.js ] <───> [ db.json (Persistência) ]
               ▲
               │ (HTTP Polling /api/current-media a cada 5s)
         [ iPad Mini 3 ]
```

- **Backend**: Servidor HTTP em Node.js com Express que gerencia as requisições e salva o estado de forma persistente no arquivo local `db.json` (evitando perda de dados se o servidor reiniciar).
- **Painel /admin**: Interface moderna e responsiva voltada para celulares. Permite gerenciar URLs de imagens e vídeos, ver o status online/offline do iPad e comandar a exibição ativa.
- **Player /player**: Página extremamente enxuta. Utiliza polling HTTP (a cada 5s) e um heartbeat persistente. Escrita em JavaScript compatível com o Safari do iOS 12.

---

## 🛠️ Como Executar Localmente

### Pré-requisitos
- Node.js instalado (versão 14 ou superior recomendada).

### Instalação
1. Clone ou extraia os arquivos do projeto no diretório desejado.
2. Abra o terminal na pasta raiz e instale as dependências:
   ```bash
   npm install
   ```

### Execução
Inicie o servidor local executando:
```bash
npm start
```
O servidor estará rodando na porta `3000`. No console será exibido o endereço local e a porta.

---

## 🌐 Como Acessar e Testar

Para testar na sua rede local (com o celular e o iPad conectados no mesmo roteador Wi-Fi):

1. **Descubra o IP local da sua máquina**:
   - No Windows (PowerShell/CMD): execute `ipconfig` e procure pelo "Endereço IPv4" da rede Wi-Fi (ex: `192.168.1.15`).
2. **Acesso pelo Celular (Admin)**:
   - Abra o navegador no celular e digite: `http://<IP-DA-MAQUINA>:3000/admin`
3. **Acesso pelo iPad Mini 3 (Player)**:
   - Abra o Safari no iPad e digite: `http://<IP-DA-MAQUINA>:3000/player`

---

## 📲 Como Instalar como PWA no iPad Mini 3

Para rodar o player como um aplicativo nativo em tela cheia (ocultando a barra de endereços do Safari):

1. No iPad Mini 3, abra o Safari e navegue para o endereço do player: `http://<IP-DA-MAQUINA>:3000/player`.
2. Toque no botão de **Compartilhar** (ícone de seta saindo de um quadrado na barra do Safari).
3. Selecione a opção **"Adicionar à Tela de Início"** (Add to Home Screen).
4. Confirme o nome e toque em **Adicionar**.
5. Saia do Safari, localize o ícone "Mini Signage" na Tela de Início do iPad e abra-o.
   - O player agora abrirá no modo PWA Standalone (sem barras de navegação).

---

## 🛠️ Modo de Diagnóstico (Debug)

Se precisar visualizar o que está acontecendo por trás das telas diretamente no iPad:
1. Acesse o player com o parâmetro de debug na URL:
   ```
   http://<IP-DA-MAQUINA>:3000/player?debug=1
   ```
2. Um painel semi-transparente aparecerá no canto superior esquerdo mostrando:
   - **Status**: Se o sinalizador está ativo no servidor.
   - **Sincronização**: Hora da última checagem de conteúdo (HH:MM:SS).
   - **Tipo**: `IMAGE` ou `VIDEO`.
   - **Media ID**: ID do conteúdo no banco de dados.
   - **Versão**: Contador de modificação incremental.

---

## ⚠️ Limitações Conhecidas do iPad Mini 3 & Safari Antigo

Ao rodar no iPad Mini 3 (máximo iOS 12.5.7), considere as seguintes restrições:

1. **Bloqueio de Autoplay de Vídeos**:
   - O Safari impede a reprodução automática de vídeos se não houver interação prévia do usuário, mesmo que estejam marcados com `autoplay` e `muted`.
   - **Solução implementada**: Se o navegador bloquear o autoplay, o player exibe automaticamente o botão `"TOQUE PARA INICIAR"`. Um toque na tela ativa o motor de áudio/vídeo e as mídias seguintes rodarão sem intervenções adicionais.
2. **Incompatibilidade de Sintaxe JS Moderna**:
   - O Safari do iOS 12 **não suporta** sintaxes ES2020+ como o encadeamento opcional (`?.`), coalescência nula (`??`) ou atribuições lógicas (`||=`).
   - **Solução implementada**: O JavaScript do player foi escrito de forma conservadora em ES6 e ES5 clássico para evitar erros de sintaxe (tela branca).
3. **Consumo de Memória**:
   - O iPad Mini 3 possui apenas 1GB de RAM. Evite usar URLs de imagens gigantescas (acima de 4K) ou vídeos com alto bitrate para não fechar o app por falta de memória.

---

## 🎥 Formatos Recomendados de Mídias

Para garantir fluidez absoluta na reprodução no iPad Mini 3:

* **Imagens**:
  - Formato: `JPG` ou `PNG`.
  - Resolução recomendada: `1024x768` ou `2048x1536` (resolução nativa da tela Retina do iPad Mini 3).
  - Evite formatos modernos como `WEBP` ou `AVIF`, pois o suporte em iOS 12 é limitado ou inexistente.

* **Vídeos**:
  - Formato/Container: `MP4` (`.mp4`).
  - Codec de Vídeo: `H.264` (perfil baseline ou main).
  - Codec de Áudio: `AAC` (sempre mute por padrão).
  - Resolução recomendada: `1280x720` (720p) ou no máximo `1920x1080` (1080p).
  - Evite codecs modernos como `HEVC / H.265`, `VP9` ou `AV1` que exigem processamento que o iPad Mini 3 não possui em hardware de forma estável.

---

## 🌐 Como Publicar (Deploy)

Para rodar em ambiente público (acesso remoto real de qualquer lugar do mundo):

1. **Render / Heroku / Railway**:
   - O projeto já está estruturado com `package.json` padrão e lê a porta pela variável `PORT`.
   - Você pode conectar o repositório do GitHub diretamente em plataformas como o **Render** ou **Railway**.
2. **Banco de Dados local**:
   - O arquivo `db.json` será gerado automaticamente. Caso use plataformas serverless que apagam arquivos locais durante novas versões (como o Heroku), você pode notar o reset da biblioteca de mídia para as mídias de demonstração originais, o que é perfeitamente aceitável para testes iniciais de MVP.
