# Guia de Configuração: Impressão Silenciosa (Kiosk Printing)

Este documento contém o passo a passo completo para configurar a **Auto-Impressão Silenciosa de Pedidos** em impressoras térmicas de 80mm no painel Kanban da padaria.

Com o modo silencioso ativado, assim que um novo pedido chega pelo WhatsApp ou Cardápio Web, o sistema imprime o comprovante térmico **imediatamente e em segundo plano**, sem abrir janelas de confirmação no navegador.

---

## 📋 Pré-requisitos

1. Impressora térmica de 80mm (USB, Rede ou Serial) instalada e funcionando no computador do caixa.
2. Navegador **Google Chrome** ou **Microsoft Edge**.

---

## 🖨️ Passo 1: Definir a Impressora Térmica como Padrão do Sistema

Para que a impressão automática vá para a impressora correta sem perguntar, ela deve estar configurada como a impressora padrão do sistema operacional.

### No Windows:
1. Abra o **Painel de Controle** ou acesse `Configurações > Bluetooth e dispositivos > Impressoras e scanners`.
2. Clique na sua impressora térmica de 80mm (ex: Bematech, Daruma, Elgin, Epson).
3. Clique em **Definir como padrão**.
4. Nas **Preferências de Impressão** da impressora, verifique se o tamanho do papel está definido para **80mm (ou 80 x 297 mm / Roll Paper 80mm)** e as margens zeradas.

### No macOS:
1. Abra `Ajustes do Sistema > Impressoras e Scanners`.
2. Em **Impressora Padrão**, selecione a sua impressora térmica de 80mm.

---

## 🚀 Passo 2: Configurar o Navegador para Impressão Silenciosa (`--kiosk-printing`)

A flag `--kiosk-printing` instrui o navegador a ignorar a caixa de diálogo de impressão e enviar o documento diretamente para a impressora padrão.

### No Windows (Google Chrome / Microsoft Edge):

1. Vá para a **Área de Trabalho** (Desktop).
2. Clique com o **botão direito** no atalho do **Google Chrome** (ou Edge) e selecione **Propriedades**.
3. Na aba **Atalho**, localize o campo **Destino (Target)**.
4. Adicione um espaço e a flag `--kiosk-printing` ao final do texto entre aspas.
   
   *Exemplo para o Chrome:*
   ```cmd
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing
   ```
   
   *Exemplo para o Microsoft Edge:*
   ```cmd
   "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk-printing
   ```
5. Clique em **Aplicar** e depois em **OK**.

> ⚠️ **IMPORTANTE (Windows)**: Feche todas as janelas abertas do Chrome/Edge antes de abrir pelo novo atalho, para que o parâmetro seja carregado na memória.

---

### No macOS (Google Chrome):

Você pode iniciar o Chrome com impressão silenciosa através do Terminal ou criar um atalho executável `.command`.

#### Via Terminal:
```bash
open -na "Google Chrome" --args --kiosk-printing
```

#### Criando um atalho `.command` de 1-clique na Área de Trabalho:
1. Criar um arquivo chamado `Abrir_Caixa.command` na Área de Trabalho:
   ```bash
   echo '#!/bin/bash' > ~/Desktop/Abrir_Caixa.command
   echo 'open -na "Google Chrome" --args --kiosk-printing "http://localhost:3000/admin"' >> ~/Desktop/Abrir_Caixa.command
   chmod +x ~/Desktop/Abrir_Caixa.command
   ```
2. Dar duplo clique em `Abrir_Caixa.command` para iniciar o Chrome já configurado.

---

## 🔘 Passo 3: Ativar a Auto-Impressão no Painel Kanban

1. Abra o painel Kanban no navegador configurado:
   [http://localhost:3000/admin](http://localhost:3000/admin)
2. No cabeçalho superior (ao lado de *Real-time Ativo*), clique no botão:
   `Auto-Impressão: Desativada` -> **`Auto-Impressão: Ativada`**
3. A opção permanecerá **Ativada** mesmo se você fechar o navegador, pois a preferência fica salva no `localStorage` do computador.

---

## 🧪 Testando a Impressão Automática

1. Garanta que a **Auto-Impressão** está **Ativada** no Kanban.
2. Envie um novo pedido de teste pelo WhatsApp ou pelo Cardápio Web.
3. O evento `ORDER_CREATED` chegará em tempo real via WebSocket, o som de notificação tocará e o comprovante térmico de 80mm será **impresso imediatamente na impressora física sem qualquer clique**.

---

## ❓ Resolução de Problemas (Troubleshooting)

| Problema | Causa Provável | Solução |
| :--- | :--- | :--- |
| A janela de impressão continua aparecendo | Chrome não carregou a flag `--kiosk-printing` | Feche **todas** as janelas e processos do Chrome no Gerenciador de Tarefas e abra pelo atalho modificado. |
| O cupom sai cortado ou com margens em branco | Tamanho do papel incorreto no driver da impressora | Vá nas propriedades da impressora no Windows e defina o papel para `Roll Paper 80mm` ou `80 x 297mm` com margens 0. |
| O cupom é impresso em outra impressora | Impressora térmica não é a padrão | Defina a impressora térmica de 80mm como a **Impressora Padrão** do sistema operacional. |
