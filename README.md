# Bisect

Desafio **diário**: um país por dia, **3 tentativas às cegas** para traçar a reta
que o divida o mais perto possível de **50/50**. Vês as duas metades coloridas
enquanto arrastas, mas os números só aparecem quando confirmas; entre tentativas
recebes uma dica direcional. Conta a melhor das 3.

- **Ronda 1 — Área** (204 países — todos exceto cidade-estado como Mónaco/Vaticano)
- **Ronda 2 — Rios** (141 dos 204): os rios do país desenhados no mapa; divide o
  *comprimento total* de rio a 50/50. Como os rios seguem o terreno e não a
  costa, a linha certa fica pelo meio — não colada ao litoral como a de
  população. (Países sem rios significativos — desertos, pequenas ilhas — saltam
  esta ronda.)
- **Ronda 3 — População** (197 dos 204): **às cegas** — nada no mapa, adivinhas
  onde se concentra a população e divides os *habitantes* a 50/50. As cidades
  (círculo ∝ população) só aparecem no ecrã de resultado. Em Portugal a linha
  certa vai muito a oeste por causa de Lisboa + Porto.

Pontuação do dia = melhor de cada ronda, somadas (100, 200 ou 300).

`?dev` no URL ignora o bloqueio de uma jogada/dia; `?dev&country=FRA` força um país.

## Correr

```bash
npm install
npm run dev              # http://localhost:5173  (usa ?dev para repetir)
npm test                 # testes do motor de jogo
npm run build            # typecheck + build estático para dist/
npm run data             # (re)gera países + população + manifest.json
```

## Como está estruturado

O jogo é um **site 100% estático**: dados pré-processados servidos como
ficheiros, cálculo no browser, sem servidor. Um backend só entra (opcional)
se quisermos leaderboard global.

```
public/data/
  manifest.json            204 países: id, iso_a2, nome (pt/en/es/fr/de), área, pop_est, dificuldade, modos
  countries/<ISO>.json      Feature GeoJSON, detalhe conforme o tamanho (~5 KB médio)
  population/<ISO>.json      { total, cities: [[lng,lat,pop], ...] }  (~3 KB, 197 países)
  rivers/<ISO>.json          { totalKm, rivers: [[[lng,lat], ...], ...] } (~11 KB, 141 países)
  solutions/<iso>.json       linha ótima pré-calculada (a construir)

scripts/                     preparação de dados, corre em Node, offline
  build-countries.ts         Natural Earth 50m -> mapshaper (detalhe adaptativo) -> filtra + dificuldade + iso_a2
  build-population.ts        GeoNames cities1000 -> pontos com peso por país (top 250)
  build-rivers.ts            Natural Earth 10m rios -> recorta polilinhas por país
  build-solutions.ts         procura a melhor linha por país/modo  (a construir)

src/game/                    MOTOR PURO — sem DOM, testável
  geo.ts                     área geodésica de anéis; sideOfLine
  rewind.ts                  normaliza winding dos anéis para o d3-geo
  engine.ts                  splitByLine + areaSplit
  modes.ts                   interface Mode + areaMode
  population.ts              createPopulationMode(field) — soma população das cidades por lado
  rivers.ts                  createRiverMode(field) — soma comprimento de rio por lado
  scoring.ts                 fração -> pontos
  feedback.ts                dica direcional entre tentativas
  daily.ts                   data -> país; contagem decrescente
  optimize.ts                melhor linha reta (área ou métrica dada)
  share.ts                   texto de partilha estilo Wordle (barras por tentativa/ronda)
  storage.ts                 histórico/streak em localStorage (reducer puro + wrappers)

src/render/                  desenho e interação (canvas + d3-geo)
  projection.ts  draw.ts  interaction.ts

src/ui/                      DOM da interface
  result.ts                  ecrã final (melhor de 3, barras, stats, contagem, partilha)
  help.ts                    diálogo "Como jogar" (1ª visita + botão ?)
  clipboard.ts               Web Share API -> clipboard -> fallback

src/data/loader.ts           fetch do manifest e dos países (+ rewind defensivo)
src/main.ts                  máquina de estados das 3 tentativas + cola tudo
```

**Regra de ouro:** `src/game/` não sabe nada de canvas nem de UI. É isso que
deixa acrescentar modos sem mexer no resto.

**Idiomas:** [src/i18n.ts](src/i18n.ts) — tabelas de strings para PT/EN/ES/FR/DE +
`t` (idioma ativo), `n0/n1/n2` (números com `Intl.NumberFormat` da locale). O
idioma vem do `localStorage` ou do `navigator.language`; mudá-lo recarrega a
página. Nomes dos países vêm do manifesto (`name`, `name_en`, `name_es`, …, do
Natural Earth). O `feedback.ts` devolve dados estruturados; a frase é montada na
UI a partir do `t`.

## Roadmap

1. ✅ Motor `areaSplit` + testes
2. ✅ Protótipo: silhueta + arrastar linha + pontuação
3. ✅ Ecrã de resultado + partilha em texto/emoji
4. ✅ Pipeline de dados: `build-countries.ts` — 204 países (detalhe adaptativo) + dificuldade 1-5
5. ✅ Ciclo diário: 3 tentativas às cegas + dica direcional, melhor de 3,
   `localStorage` (uma jogada/dia, streak, média, histórico), contagem decrescente
6. ✅ Rondas por métrica no mesmo país: rios (NE, 141/204) + população
   (GeoNames, 197/204); alternador área/rios/população no ecrã de resultado
7. ✅ Canvas responsivo + "Como jogar" + **5 idiomas** (PT/EN/ES/FR/DE) com seletor
8. ✅ Info do país no ecrã de resultado (bandeira, nome, área, população, dificuldade)
9. Modo treino (qualquer país, sem pontuação)
10. (Opcional) leaderboard — Cloudflare Pages + Worker + D1/KV

## Dados

- **Fronteiras:** [Natural Earth 1:50m](https://www.naturalearthdata.com/)
  admin_0_countries, via o mirror
  [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector)
  (domínio público). `npm run data:countries` faz download (cache em `data-src/`),
  simplifica com mapshaper **com detalhe conforme o tamanho do país** (3 km nos
  grandes, 1,2 km nos médios, 250 m nos pequenos — 3 km é invisível no Canadá mas
  é a largura toda de Malta), larga dependências e cidade-estado (< 100 km²:
  Mónaco, Vaticano, Nauru, Tuvalu, São Marino), corta territórios ultramarinos
  (só se mantêm os polígonos a menos de 5° da massa terrestre principal — p. ex.
  França fica só a metropolitana, EUA só os 48 contíguos) e calcula uma
  dificuldade 1-5 a partir da compacidade (área / fecho convexo) e do nº de
  fragmentos.
- **Rios:** Natural Earth 1:10m `rivers_lake_centerlines` (só `featurecla=River`),
  domínio público. `npm run data:rivers` recorta as polilinhas dentro de cada
  país (teste ponto-em-polígono no ponto médio de cada segmento), simplifica a
  ~2 km, e fica pelas mais compridas até 4 000 vértices. País entra na ronda de
  rios com ≥ 40 km de rio mapeado → **141 / 204**. O dataset base do NE é só os
  rios maiores, por isso desertos e ilhas pequenas (e uns poucos como Cuba /
  Dinamarca, mal mapeados) ficam de fora — jogam 2 rondas. Upgrade futuro:
  HydroRIVERS.
- **População:** [GeoNames](https://www.geonames.org/) `cities1000` (~159 mil
  lugares com população ≥ 1000), **CC BY 4.0**. `npm run data:population` junta
  por código ISO alpha-2 (via `iso_a2` do manifesto), filtra ao bounding box do
  país (tira territórios), fica pelas 250 maiores, e escreve pontos com peso
  `[lng, lat, população]`. Um país entra no modo população com ≥ 5 cidades →
  **197 / 204** (ficam de fora Malvinas, Chipre do Norte, Somalilândia,
  Caxemira, Kiribati, Micronésia, BIOT).
  É um proxy (só cidades, ignora o rural), mas o formato — pontos com peso — é o
  mesmo que uma grelha raster daria, por isso trocar a fonte depois não mexe no
  modo. Upgrade futuro: GHS-POP / Kontur agregado a grelha.

## Deploy

Site **estático** — `npm run build` gera `dist/`. `base: "./"` no
`vite.config.ts` mantém o build portável (subpaths incluídos). O `public/data/`
gerado (~2 MB) está no repo, por isso o CI só corre `npm ci && npm run build` —
**não** precisa de `npm run data` (os downloads grandes vivem em `data-src/`,
ignorado pelo git).

**GitHub Pages** — já configurado em [.github/workflows/deploy.yml](.github/workflows/deploy.yml):
1. `git init && git add -A && git commit -m "Bisect"`
2. Cria um repo vazio no GitHub e faz `git push`
3. No repo: **Settings → Pages → Source: GitHub Actions**
4. Cada `push` para `main` recompila e publica em `<user>.github.io/<repo>/`

**Netlify / Cloudflare Pages** — build command `npm run build`, publish dir
`dist`, ou arrastar a pasta `dist/` para [app.netlify.com/drop](https://app.netlify.com/drop).

Cada jogada só descarrega o país do dia (~5 KB) + população (~3 KB) + rios
(~11 KB) + `manifest.json`.
