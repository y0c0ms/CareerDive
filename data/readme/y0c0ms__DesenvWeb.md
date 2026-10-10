# Festival Vilar de Mouros 2025

Este projeto é um website para o Festival Vilar de Mouros 2025. O site foi desenvolvido como exercício de HTML, CSS e JavaScript, e possui as seguintes funcionalidades:

## Funcionalidades

### Página Inicial (index.html)

- **Layout Responsivo e Consistente:**  
  Todas as páginas possuem um layout centralizado e estilizado de forma consistente, com um container principal que utiliza CSS para definir cores, margens, sombras e bordas arredondadas.

- **Cabeçalho com Imagem:**  
  O header inclui um título e uma imagem do festival.

- **Efeito Hover:**  
  A imagem do festival desaparece (através de um efeito de opacidade) quando o usuário passa o rato sobre ela, e reaparece quando o rato é retirado.

- **Menu de Navegação Responsivo:**  
  O menu de navegação foi estilizado para se apresentar como botões responsivos, com cores e transições semelhantes ao exemplo do W3Schools.

- **Slideshow:**  
  Um slideshow exibe uma sequência de imagens dos festivais anteriores (por exemplo, "multidao2022.png" e "rio2003.jpeg", além de outras imagens presentes na pasta `imgs`).  
  As imagens alternam automaticamente a cada 3 segundos.

- **Conteúdo e Programação:**  
  A página inclui seções sobre o festival, a programação (tabelas com horários e artistas para diferentes datas) e links para festivais recomendados.

### Página de Candidatura a Voluntário (voluntario.html)

- **Formulário Dinâmico:**  
  O formulário permite que o voluntário insira nome, contato e selecione quantos dias pode estar presente utilizando um slider.  
  Conforme o valor do slider (de 1 a 4), os grupos de data/hora são exibidos dinamicamente.  
  Se o valor máximo (4) for selecionado, os selects são automaticamente preenchidos com os dias fixos do festival (21, 22, 23 e 24).  
  Os campos de data utilizam `<select>` para limitar as opções aos dias 21, 22, 23 e 24.

- **Validação de Comentário:**  
  O formulário inclui um campo para comentários com um botão **"Validar comentário"**.  
  A função JavaScript `validateComment()` verifica se o comentário contém palavras proibidas.  
  A verificação é **case-insensitive** e **accent-insensitive**, utilizando a normalização de texto (com `normalize("NFD")` e remoção de diacríticos).  
  Caso o comentário contenha alguma das palavras proibidas (como "abécula", "abentesma", "achavascado", entre outras), o comentário é rejeitado, o campo é limpo e um alerta é exibido.

### Página de Confirmação (aceite.html)

- **Mensagem de Aceitação:**  
  Ao submeter o formulário de candidatura, o usuário é redirecionado para uma página que confirma que a candidatura foi aceita, com um botão para retornar à página inicial.

## Considerações

- **Imagens:**  
  Certifique-se de que todas as imagens referenciadas (por exemplo, as imagens do slideshow e a imagem do festival) estão na pasta correta conforme os caminhos definidos no HTML.

- **Validação do Comentário:**  
  A lista de palavras proibidas está configurada para rejeitar palavras específicas independentemente de variações de acentuação e maiúsculas/minúsculas.

- **Compatibilidade:**  
  O site foi desenvolvido para funcionar em navegadores modernos que suportem as APIs de normalização de strings (`normalize()`) e outros recursos do JavaScript ES6+.
