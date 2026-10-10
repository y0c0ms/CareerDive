# ES-2024-1Sem-LETI-GrupoI

## Membros do Grupo
- Manuel Santos (111087) - [y0c0ms](https://github.com/y0c0ms)
- Miguel Reis (111035) - [miguelcreis](https://github.com/miguelcreis)
- João Oliveira (111568) - [JoaoOliveira](https://github.com/JoaoOIiveira)
- André Costa (11118) - [Andre3648](https://github.com/Andre3648)

## Principais Funcionalidades
- **Adjacency Checker**: Verifica se duas propriedades são adjacentes pelos seus OBJECTIDs.
- **Area Calculator**: Calcula a área média das propriedades em uma área geográfica/administrativa indicada pelo utilizador (freguesia, concelho, distrito) e também têm a opção de agrupar as propriedades adjacantes do mesmo dono para o cálculo.
- **Owner Graph**: Representa a relação de vizinhança entre proprietários, onde os nós representam os proprietários e as arestas representam as relações de vizinhança entre eles.
- **Property Exchange Suggestions**: Gera sugestões para troca de propriedades entre proprietários, maximizando a área média das propriedades por proprietário.

### Principais Problemas
- Issue 1: Inicialmente pensávamos que os grafos deveriam ser diagramas pelo que tentamos desenvolver uma classe que faria estes diagramas (sem muito sucesso).

## Dependências Utilizadas
- **JUnit Jupiter API 5.9.1**
  - Descrição: Biblioteca de testes unitários para Java, parte do JUnit 5, que fornece a API para escrever testes.
- **JUnit Jupiter Engine 5.9.1**
  - Descrição: Motor de execução de testes para JUnit 5, necessário para executar testes escritos com a API do JUnit Jupiter.
- **Apache Commons CSV 1.8**
  - Descrição: Biblioteca para leitura e escrita de arquivos CSV de forma simples e eficiente.
- **JGraphT Core 1.5.2**
  - Descrição: Biblioteca para modelagem e manipulação de grafos em Java.
- **JTS Core 1.18.0**
  - Descrição: Biblioteca para manipulação de geometria espacial, usada para operações como interseção, união e cálculo de área.
- **JavaFX Controls 22**
  - Descrição: Conjunto de componentes de interface gráfica (GUI) para JavaFX, incluindo botões, tabelas, listas, etc.
- **JavaFX FXML 22**
  - Descrição: Suporte para FXML, uma linguagem baseada em XML para definir interfaces de usuário em JavaFX.
- **JavaFX Graphics 22**
  - Descrição: Biblioteca gráfica para JavaFX, que fornece APIs para renderização de gráficos, imagens e formas.

## Tecnologias Utilizadas
- **Ambiente de Programação / IDE**: Visual Studio Code (VSCode)
- **Gestão de Configurações / Controle de Versões no Repositório Local**: SCM Git
- **Gestão de Configurações / Controle de Versões no Repositório Remoto**: GitHub.com
- **Gestão de Dependências**: Maven
- **Avaliação da Qualidade do Software**: Qodana
- **Testes e Avaliação de Cobertura de Testes**: JUnit
- **Documentação do Software**: JavaDoc
- **Gestão do Projeto**: Abordagem Scrum utilizando Trello com Power-Up do GitHub para rastreio entre os cartões das user stories e os eventos respetivos no GitHub (commits, pull requests)

## Relatório de Avaliação da Qualidade do Software
O relatório de avaliação da qualidade do software pode ser encontrado [aqui](src\main\resources).