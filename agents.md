# Instruções para Agentes

## 1. Commit ao fim de cada demanda

Ao concluir qualquer demanda solicitada pelo usuário, sempre realizar um commit com as alterações feitas. O commit deve:

- Incluir todos os arquivos modificados relevantes para a demanda
- Ter uma mensagem clara e descritiva sobre o que foi feito
- Ser criado apenas após a demanda estar completamente concluída

## 2. Painel administrativo

- Usar Tailwind CSS para novas telas e alterações de interface no admin; não adicionar Bootstrap.
- Migrar telas antigas para Tailwind gradualmente, sem reescrever páginas fora do escopo da demanda.
- Seguir o estilo aprovado para o admin: gradientes suaves rosa/lilás, superfícies translúcidas claras, desfoque de fundo, cantos arredondados e acentos roxos.
- Manter o menu lateral no mesmo estilo visual do dashboard.
- Em listagens com paginação fixa, alinhar a barra às margens e à largura do conteúdo, reservar espaço no fim da página e evitar cobrir registros.
- Em telas de listagem que pedem filtro sticky, manter o painel preso ao topo durante a rolagem.
- Quando aplicável, permitir escolher o número de itens por página e reiniciar na primeira página ao alterar o tamanho.

## 3. Filtro de IP dos logs de auditoria

- Aceitar endereços IPv4 e IPv6 no campo de IP e validar o endereço antes de aplicar o filtro.
- Aplicar o filtro no backend por correspondência exata com o IP informado.

## 4. Publicação

- Não publicar alterações sem solicitação explícita do usuário.
- Commits na branch `master` que alterem `api/**` publicam a API pelo workflow automático; alterações em `admin/**` publicam o painel.
- Preservar os arquivos `.env` e os uploads persistentes do servidor durante deploys da API.
