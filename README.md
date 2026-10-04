# Caderno da Maratona de Gestão

Documentação em Markdown, com navegação, busca, índice e perguntas com respostas expansíveis. Você escreve no editor local ou no VS Code; seus colegas leem o site publicado no GitHub Pages.

O projeto é uma aplicação pequena em Node.js e JavaScript, sem Docusaurus e sem dependências de instalação. O renderizador Markdown está incluído com sua licença. Não precisa de banco de dados nem serviços externos para rodar localmente.

## 1. Rodar com Docker

Com Docker Desktop (Windows/macOS) ou Docker Engine e Compose (Linux) instalados, abra um terminal **na pasta que contém este README**:

```bash
docker compose up --build -d
```

Abra **http://localhost:3000**. Use **Editar página** ou **Nova página**. O app grava os arquivos diretamente na pasta `docs/` do seu computador, montada no container. Parar ou recriar o container não remove esses arquivos.

No Linux, se seu usuário não tiver UID/GID 1000, rode com seus identificadores para conseguir gravar:

```bash
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up --build -d
```

Esses identificadores podem ser colocados em um arquivo `.env` local para os próximos comandos. Windows e macOS geralmente não precisam desse ajuste.

Para parar:

```bash
docker compose down
```

Para consultar problemas:

```bash
docker compose logs app
```

Também funciona sem Docker, com Node.js 22 ou mais recente:

```bash
npm start
```

## 2. Preencher o caderno

As páginas dos três dias são pontos de partida editáveis. Há um exemplo de conceito e um glossário. Os resumos iniciais identificam sua origem no treinamento; complete com suas anotações e confira referências antes de apresentar uma definição como oficial.

Você pode editar `docs/*.md` diretamente e atualizar o navegador. Para criar uma página pelo editor de texto, copie `docs/_modelo.md` para um nome como `docs/stakeholders.md`. Arquivos que começam com `_` não aparecem no site.

Exemplo de metadados no início da página:

```yaml
---
title: "Stakeholders"
section: "Conceitos"
summary: "Quem influencia ou é afetado pelo projeto."
source: "Notas do Dia 2"
order: 12
revision: 1
---
```

- `title`: nome exibido na navegação e na página.
- `section`: grupo na navegação. Basta usar o mesmo nome para agrupar páginas.
- `summary`: introdução curta.
- `source`: origem do conteúdo: treinamento, anotações ou referência.
- `order`: ordem das páginas e das seções; números menores aparecem primeiro.
- `revision`: versão usada pelo editor local para detectar alterações em outras abas.

Use valores em uma linha; aspas duplas são aceitas no formato JSON. Este parser cobre os campos do modelo, não todos os recursos de YAML. O nome do arquivo vira o identificador da URL; use letras minúsculas sem acento, números e hífens.

Depois dos metadados, escreva Markdown. Use `##` nos títulos para montar automaticamente o índice. Tabelas, listas, blocos de código, links e imagens são suportados.

Para navegar entre páginas:

```markdown
[Ver o Dia 2](#dia-2)
```

Para incluir um desenho, salve SVG, PNG, JPG ou WebP em `public/diagrams/`:

```markdown
![Descrição do desenho](./diagrams/meu-desenho.svg)
```

O projeto inclui um SVG de exemplo. Não há renderizador Mermaid nesta versão; exporte seu diagrama como SVG ou imagem.

Para perguntas expansíveis:

```html
<details>
<summary>Qual a diferença entre POC e MVP?</summary>

Escreva a resposta em Markdown, com linhas em branco antes e depois.

</details>
```

HTML é filtrado para preservar a leitura segura; scripts, estilos e componentes React não são executados. Não edite a mesma página simultaneamente pelo navegador e por um editor de texto. Se houver conflito entre abas, o texto permanece no editor para você copiá-lo antes de recarregar.

## 3. Criar seu repositório

Crie um repositório vazio no GitHub, por exemplo `maratona-gestao`. Coloque **os arquivos desta pasta na raiz** do repositório, incluindo `.github/workflows/pages.yml` e os arquivos iniciados por ponto.

Se preferir usar Git no terminal:

```bash
git init -b main
git add .
git commit -m "Cria caderno da maratona"
git remote add origin https://github.com/SEU-USUARIO/maratona-gestao.git
git push -u origin main
```

Troque `SEU-USUARIO` e o nome do repositório. As alterações ainda não publicadas permanecem locais até você fazer commit e push.

## 4. Ativar GitHub Pages

1. No repositório, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, selecione **GitHub Actions**.
3. Abra **Actions → Publicar caderno no GitHub Pages → Run workflow** e selecione `main`. Se a primeira execução ocorreu antes da configuração do Pages, execute novamente.
4. Aguarde os jobs `build` e `deploy`. O link final aparece no deployment e em **Settings → Pages**.

O endereço normalmente será `https://SEU-USUARIO.github.io/maratona-gestao/`. Os caminhos são relativos, então o nome do repositório pode mudar sem alterar a configuração do app.

Após a configuração inicial, cada push em `main` gera e publica o site automaticamente. Não é necessário criar tokens ou secrets. O workflow usa as permissões do próprio GitHub Actions. O teste e a exportação também funcionam em um repositório que você clonar depois.

Para publicar alterações:

```bash
git add docs public
git commit -m "Atualiza conteúdo de estudo"
git push
```

O site publicado oferece leitura e busca. O editor e a API existem apenas no app local. O GitHub Pages não executa o container nem salva alterações de visitantes. **Tudo que está em `docs/` e `public/` é incluído no site publicado**; coloque ali apenas o material que deseja compartilhar.

Repositórios públicos normalmente são o caminho mais simples para Pages. A disponibilidade em repositórios privados depende do plano e das políticas da organização. Repositório privado não significa automaticamente site de leitura privado.

## 5. Compartilhar com colegas

Para **leitura**, compartilhe o link do Pages. Para alguém **rodar e editar sua própria cópia**, compartilhe o repositório ou um ZIP completo, incluindo `.github` e os arquivos de configuração. A pessoa clona/extrai e roda `docker compose up --build -d`.

Alterações de duas instalações não são sincronizadas automaticamente: colaboradores usam commits e pull requests no repositório.

## Exportação e verificação local

```bash
npm test
npm run export:pages
```

O segundo comando cria `github-pages/`, com arquivos estáticos, dados das páginas e todos os recursos necessários. Não publique o código do servidor: o workflow envia somente essa pasta gerada.

Se quiser gerar a exportação usando apenas Docker:

```bash
docker compose exec app npm run export:pages
docker compose cp app:/app/github-pages ./github-pages
```

Para testar a pasta exportada com Node:

```bash
npm run preview:pages
```

Abra http://localhost:4000/maratona-gestao/. Esse caminho simula um site de projeto no GitHub Pages. Não abra o HTML diretamente com `file://`, pois o navegador precisa buscar `data.json`.

## Organização dos arquivos

| Caminho | Finalidade |
| --- | --- |
| `docs/` | Páginas Markdown que você preenche e versiona. |
| `docs/_modelo.md` | Modelo para novas páginas, oculto no site. |
| `public/` | Interface, estilos, biblioteca Markdown e desenhos. |
| `server.mjs` | Servidor e editor locais. |
| `content-store.mjs` | Leitura e gravação dos arquivos Markdown. |
| `scripts/export-pages.mjs` | Gera a versão estática. |
| `compose.yaml` e `Dockerfile` | Execução local com Docker. |
| `.github/workflows/pages.yml` | Publicação automática no Pages. |

O app está limitado a 500 páginas, até 200 mil caracteres por página. É um caderno para leitura compartilhada e autoria local; não é um editor simultâneo online com contas e permissões.

Referências de configuração: [workflows do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) e [bind mounts do Docker](https://docs.docker.com/engine/storage/bind-mounts/).

O renderizador Marked conserva sua licença em `public/vendor/MARKED-LICENSE.md`. O conteúdo inicial inclui exemplos de aplicação elaborados para este caderno e resumos dos treinamentos; não reproduz integralmente os materiais anexados.
