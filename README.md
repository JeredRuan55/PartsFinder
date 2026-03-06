# 🐍 Snake Domain .io (Documentação do Projeto)

## 📝 Visão Geral
Um jogo multiplayer (ou simulação) web-based onde cobras não lutam apenas por tamanho, mas por domínio geográfico. O objetivo é cercar áreas para expandir seu império, ganhando bônus táticos dentro das suas fronteiras.

## 🕹️ Mecânicas de Gameplay

### 1. Conquista de Território
- **O Rastro:** Ao sair da sua zona segura, a cobra deixa um rastro translúcido.
- **O Fechamento:** Quando a cabeça da cobra toca qualquer parte da sua zona segura novamente, a área cercada pelo rastro é preenchida e se torna seu território.
- **Bônus de Zona (Home Turf Advantage):**
  - **Velocidade:** +25% de boost automático.
  - **Orbes:** Gerados passivamente a cada 10 segundos dentro da área.
  - **Debuff Inimigo:** Cobras rivais sofrem 30% de lentidão ao invadir seu território.

### 2. Condições de Derrota (Game Over)
- **Morte por Colisão:** Bater a cabeça no corpo de outra cobra (estilo Slither).
- **Morte por Corte:** Se um inimigo atravessar o seu rastro ativo (enquanto você está expandindo), você é eliminado instantaneamente.

### 3. Power-ups
| Item | Efeito | Duração |
| --- | --- | --- |
| **Turbo Orb** | Aumento massivo de velocidade sem custo de massa. | 5s |
| **Venom Trail** | O rastro brilha; inimigos que tocarem perdem 10% de tamanho/área. | 8s |
| **Shield Skin** | Uma camada visual que absorve 1 colisão fatal. | Único |

## 🛠️ Arquitetura Técnica (Antigravity)
O motor Antigravity foi utilizado focado em leveza, com gerenciamento eficiente de polígonos de território. São utilizadas as seguintes camadas virtuais (ou literais usando Canvas):
- **Background Grid:** Onde os territórios conquistados são desenhados (estático, otimizado).
- **Trail Layer:** Onde o rastro temporário de cada cobra é calculado como um array de pontos.
- **Entity Layer:** As cabeças e corpos das cobras (física ativa).

**Lógica de Fechamento de Área:**
Quando a cobra retorna à base, é utilizado um algoritmo para preencher o rastro fechado e uni-lo ao território base.

---

## 🚀 Fluxo de Desenvolvimento (GitHub)

### Configuração com GitHub Desktop
1. **Repositório:** Crie o repo `snake-domain-io` no GitHub Desktop.
2. **Versionamento:** Faça commits pequenos. Ex:
   - `feat: movimentação básica da cobra`
   - `feat: lógica de rastro e desenho de polígono`
   - `fix: correção na colisão de rastro`

### Deploy no GitHub Pages
1. No repositório online, vá em **Settings > Pages**.
2. Aponte para a branch `main`.
3. *Dica:* Como a engine usa recursos em JS puro, certifique-se de que os caminhos dos assets (imagens/sons) sejam relativos (ex: `./assets/skin.png`), senão o Pages não os encontrará.
