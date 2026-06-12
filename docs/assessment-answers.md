# Avaliação Técnica - Engenheiro de Software Back-end

Data: 12 de junho de 2026

Repositório público:
https://github.com/C4BRALL/english-dictionary-api

## Questões objetivas

### Questão 1

**Alternativa selecionada:** O código pode usar tanto RabbitMQ quanto Kafka como
broker de mensagens, pois a aplicação depende de uma abstração `messageBroker`.

**Justificativa:** O trecho não mostra o driver concreto. RabbitMQ possui
acknowledgement e negative acknowledgement nativos. Kafka usa inscrição em
tópicos e confirmação por commit de offsets; um adapter pode expor essa
semântica pela interface `ack`/`nack`. Portanto, os nomes dos métodos não
identificam, isoladamente, a tecnologia usada.

### Questão 2

**Alternativa falsa:** Cada microserviço deve usar um banco de dados relacional
como MySQL ou PostgreSQL para armazenar seus dados.

**Justificativa:** A persistência deve ser escolhida conforme o caso de uso e os
requisitos de consistência, consulta e escala. Um serviço pode usar banco
relacional, documento, chave-valor, busca ou não possuir persistência própria.

### Questão 3

**Alternativa verdadeira:** O código implementa um API Gateway que roteia
solicitações para diferentes microserviços com base em suas rotas.

**Justificativa:** Requisições para `/service1/*` e `/service2/*` são
encaminhadas para targets distintos. O trecho não implementa balanceamento,
ESB, Service Mesh ou Circuit Breaker.

### Questão 4

**Alternativa selecionada:** `User.find({ age: { $gt: 18 } });`

**Justificativa:** O operador MongoDB `$gt` significa "greater than", portanto
seleciona idades estritamente maiores que 18.

### Questão 5

**Alternativas corretas:** primeira, terceira e quinta.

1. O event loop coordena callbacks e outras tarefas assíncronas.
2. O event loop funciona em conjunto com o sistema operacional e com o pool de
   threads usado por partes do runtime.
3. Entender esse funcionamento ajuda a evitar bloqueios e otimizar desempenho,
   latência e throughput.

## Teste prático

O projeto entrega os casos de uso obrigatórios e os seguintes diferenciais:

- API NestJS com autenticação JWT e senhas protegidas por Argon2id.
- PostgreSQL 18 com importação idempotente de 370.100 palavras.
- Redis 8 para cache de buscas e detalhes.
- Headers `x-cache`, `x-response-time` e `x-correlation-id`.
- Proxy validado da Free Dictionary API.
- Histórico append-only.
- Favoritos persistidos por worker BullMQ.
- OpenAPI 3 em `/docs` e `/docs-json`.
- Docker Compose com API, worker, importer, migration, PostgreSQL e Redis.
- GitHub Actions para formatação, lint, typecheck, cobertura e build.
- Clean Architecture, SOLID, TDD e commits pequenos com Conventional Commits.

## Evidências de validação

- 370.100 palavras inseridas na primeira importação.
- Zero palavras inseridas na segunda importação, comprovando idempotência.
- Busca repetida validada com cache `MISS` e depois `HIT`.
- Detalhe repetido validado com cache `MISS` e depois `HIT`.
- Histórico persistido após consultas bem-sucedidas.
- Favorito confirmado pelo worker e consultado no PostgreSQL.
- OpenAPI publicado com os dez paths do desafio.
- Cobertura local: domínio 100%, aplicação 98%, API 99% e infraestrutura 98%
  em linhas.
- `format:check`, lint, typecheck, cobertura, build e Docker Compose aprovados.

## Execução

```bash
docker compose up -d --build
docker compose --profile tools run --rm importer
```

Documentação interativa: http://localhost:3000/docs

OpenAPI JSON: http://localhost:3000/docs-json
