import request from 'supertest';
import { createApp } from '../../src/app';

describe('API - /pedidos', () => {
  it('cria um pedido válido e retorna 201', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/pedidos')
      .send({ location: { x: 1, y: 2 }, weightKg: 1.5, priority: 'alta' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      location: { x: 1, y: 2 },
      weightKg: 1.5,
      priority: 'alta',
    });
    expect(response.body.id).toBeDefined();
  });

  it('rejeita pedido com peso acima da capacidade do drone (400)', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/pedidos')
      .send({ location: { x: 1, y: 2 }, weightKg: 999, priority: 'alta' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/excede a capacidade/i);
  });

  it('rejeita pedido com localização fora do alcance do drone (400)', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/pedidos')
      .send({ location: { x: 9999, y: 9999 }, weightKg: 1, priority: 'alta' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/excede o alcance/i);
  });

  it('rejeita corpo de requisição inválido (400)', async () => {
    const { app } = createApp();

    const response = await request(app).post('/pedidos').send({ weightKg: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it('rejeita corpo que não é um objeto JSON (400)', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/pedidos')
      .set('Content-Type', 'application/json')
      .send('123');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Corpo da requisição inválido/i);
  });

  it('rejeita peso não-finito (Infinity) com mensagem clara (400)', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/pedidos')
      .set('Content-Type', 'application/json')
      .send('{"location":{"x":1,"y":1},"weightKg":1e400,"priority":"alta"}');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/weightKg/);
  });

  it('rejeita prioridade inválida (400)', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/pedidos')
      .send({ location: { x: 1, y: 1 }, weightKg: 1, priority: 'urgentíssima' });

    expect(response.status).toBe(400);
  });

  it('lista os pedidos criados', async () => {
    const { app } = createApp();

    await request(app)
      .post('/pedidos')
      .send({ location: { x: 1, y: 1 }, weightKg: 1, priority: 'baixa' });

    const response = await request(app).get('/pedidos');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });
});

describe('API - /entregas/rota', () => {
  it('retorna vazio quando não há pedidos pendentes', async () => {
    const { app } = createApp();

    const response = await request(app).get('/entregas/rota');

    expect(response.status).toBe(200);
    expect(response.body.trips).toEqual([]);
  });

  it('aloca e simula entregas para pedidos pendentes', async () => {
    const { app } = createApp();

    await request(app)
      .post('/pedidos')
      .send({ location: { x: 1, y: 1 }, weightKg: 1, priority: 'alta' });
    await request(app)
      .post('/pedidos')
      .send({ location: { x: 2, y: 2 }, weightKg: 1, priority: 'media' });

    const response = await request(app).get('/entregas/rota');

    expect(response.status).toBe(200);
    expect(response.body.summary.totalDeliveries).toBe(2);
    expect(response.body.trips.length).toBeGreaterThanOrEqual(1);
  });
});

describe('API - /drones/status', () => {
  it('retorna lista vazia quando nenhum drone foi criado ainda', async () => {
    const { app } = createApp();

    const response = await request(app).get('/drones/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('retorna o status dos drones após uma alocação', async () => {
    const { app } = createApp();

    await request(app)
      .post('/pedidos')
      .send({ location: { x: 1, y: 1 }, weightKg: 1, priority: 'alta' });
    await request(app).get('/entregas/rota');

    const response = await request(app).get('/drones/status');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toHaveProperty('status');
    expect(response.body[0]).toHaveProperty('batteryPercent');
  });
});

describe('API - POST /simulacao/demo', () => {
  it('cria o cenário de exemplo com a quantidade padrão', async () => {
    const { app } = createApp();

    const response = await request(app).post('/simulacao/demo').send({});

    expect(response.status).toBe(201);
    expect(response.body.orders).toHaveLength(15);
  });

  it('respeita a quantidade informada', async () => {
    const { app } = createApp();

    const response = await request(app).post('/simulacao/demo').send({ quantidade: 5 });

    expect(response.status).toBe(201);
    expect(response.body.orders).toHaveLength(5);
  });

  it('gera apenas pedidos que o drone consegue atender', async () => {
    const { app } = createApp();

    await request(app).post('/simulacao/demo').send({ quantidade: 30 });
    const routes = await request(app).get('/entregas/rota');

    // Se a geração respeitou peso e alcance, nada fica sem alocação.
    expect(routes.body.unassignedOrders).toEqual([]);
  });

  it.each([0, -1, 1.5, 101, 'abc'])('rejeita quantidade inválida (%p)', async (quantidade) => {
    const { app } = createApp();

    const response = await request(app).post('/simulacao/demo').send({ quantidade });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/quantidade/);
  });
});

describe('API - GET /entregas/mapa', () => {
  it('avisa quando não há pedidos', async () => {
    const { app } = createApp();

    const response = await request(app).get('/entregas/mapa');

    expect(response.status).toBe(200);
    expect(response.text).toMatch(/Nenhum pedido/i);
  });

  it('devolve o mapa em texto puro com base e legenda', async () => {
    const { app } = createApp();

    await request(app)
      .post('/pedidos')
      .send({ location: { x: 3, y: 4 }, weightKg: 1, priority: 'alta' });

    const response = await request(app).get('/entregas/mapa');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/plain/);
    expect(response.text).toContain('MAPA DAS ENTREGAS');
    expect(response.text).toContain('@');
    expect(response.text).toContain('order-');
  });
});

describe('API - GET /entregas/comparar-estrategias', () => {
  it('retorna comparativo vazio quando não há pedidos pendentes', async () => {
    const { app } = createApp();

    const response = await request(app).get('/entregas/comparar-estrategias');

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([]);
    expect(response.body.best).toBeNull();
  });

  it('compara as estratégias e elege uma vencedora', async () => {
    const { app } = createApp();

    await request(app).post('/simulacao/demo').send({ quantidade: 20 });

    const response = await request(app).get('/entregas/comparar-estrategias');

    expect(response.status).toBe(200);
    expect(response.body.results.length).toBeGreaterThanOrEqual(3);
    expect(response.body.best).toBeTruthy();
    expect(response.body.results.filter((r: { isBest: boolean }) => r.isBest)).toHaveLength(1);
  });

  it('não altera o estado dos pedidos (execução a seco)', async () => {
    const { app } = createApp();

    await request(app).post('/simulacao/demo').send({ quantidade: 10 });
    await request(app).get('/entregas/comparar-estrategias');

    const orders = await request(app).get('/pedidos');
    orders.body.forEach((o: { assignedDroneId: string | null; isDelivered: boolean }) => {
      expect(o.assignedDroneId).toBeNull();
      expect(o.isDelivered).toBe(false);
    });

    // E nenhum drone foi criado só por comparar.
    const drones = await request(app).get('/drones/status');
    expect(drones.body).toEqual([]);
  });
});

describe('API - relatório de eficiência', () => {
  it('reporta economia de viagens e o drone mais eficiente', async () => {
    const { app } = createApp();

    await request(app).post('/simulacao/demo').send({ quantidade: 20 });
    const response = await request(app).get('/entregas/rota');

    expect(response.body.efficiency.tripsUsed).toBeGreaterThan(0);
    expect(response.body.efficiency.naiveTrips).toBe(20);
    expect(response.body.efficiency.tripsSaved).toBeGreaterThan(0);
    expect(response.body.efficiency.savingsPercent).toBeGreaterThan(0);
    expect(response.body.summary.mostEfficientDrone).toHaveProperty('droneId');
    expect(response.body.summary.mostEfficientDrone.deliveriesPerKm).toBeGreaterThan(0);
  });

  it('não reporta drone mais eficiente quando nenhuma viagem rodou', async () => {
    const { app } = createApp();

    const response = await request(app).get('/entregas/rota');

    expect(response.body.trips).toEqual([]);
  });
});

describe('API - /zonas-exclusao', () => {
  it('cria uma zona de exclusão e retorna 201', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/zonas-exclusao')
      .send({ center: { x: 5, y: 5 }, radiusKm: 2, name: 'aeroporto' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      center: { x: 5, y: 5 },
      radiusKm: 2,
      name: 'aeroporto',
    });
  });

  it('lista as zonas cadastradas', async () => {
    const { app } = createApp();

    await request(app).post('/zonas-exclusao').send({ center: { x: 5, y: 5 }, radiusKm: 2 });

    const response = await request(app).get('/zonas-exclusao');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it('remove uma zona', async () => {
    const { app } = createApp();

    const created = await request(app)
      .post('/zonas-exclusao')
      .send({ center: { x: 5, y: 5 }, radiusKm: 2 });

    const removal = await request(app).delete(`/zonas-exclusao/${created.body.id}`);
    expect(removal.status).toBe(204);

    const list = await request(app).get('/zonas-exclusao');
    expect(list.body).toEqual([]);
  });

  it('retorna 404 ao remover zona inexistente', async () => {
    const { app } = createApp();

    const response = await request(app).delete('/zonas-exclusao/zone-999');

    expect(response.status).toBe(404);
  });

  it('recusa zona que cobriria a base, o que travaria todas as entregas', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/zonas-exclusao')
      .send({ center: { x: 0, y: 0 }, radiusKm: 5 });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/base/i);
  });

  it.each([
    [{ center: { x: 1, y: 1 } }, /radiusKm/],
    [{ center: { x: 1, y: 1 }, radiusKm: 0 }, /radiusKm/],
    [{ center: { x: 1, y: 1 }, radiusKm: -2 }, /radiusKm/],
    [{ radiusKm: 2 }, /center/],
    [{ center: { x: 'a', y: 1 }, radiusKm: 2 }, /center/],
  ])('rejeita corpo inválido %p', async (body, expected) => {
    const { app } = createApp();

    const response = await request(app).post('/zonas-exclusao').send(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(expected);
  });

  describe('pedido dentro da zona', () => {
    it('caso A — zona criada antes: o pedido é recusado na entrada (400)', async () => {
      const { app } = createApp();

      await request(app)
        .post('/zonas-exclusao')
        .send({ center: { x: 3, y: 0 }, radiusKm: 1, name: 'aeroporto' });

      const response = await request(app)
        .post('/pedidos')
        .send({ location: { x: 3, y: 0 }, weightKg: 1, priority: 'alta' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/aeroporto/);
    });

    it('caso B — zona criada depois: avisa na hora quais pedidos ficaram inviáveis', async () => {
      const { app } = createApp();

      const order = await request(app)
        .post('/pedidos')
        .send({ location: { x: 3, y: 0 }, weightKg: 1, priority: 'alta' });
      expect(order.status).toBe(201);

      const zone = await request(app)
        .post('/zonas-exclusao')
        .send({ center: { x: 3, y: 0 }, radiusKm: 1, name: 'area-militar' });

      expect(zone.status).toBe(201);
      expect(zone.body.warning).toMatch(/1 pedido/);
      expect(zone.body.affectedOrders).toEqual([
        expect.objectContaining({
          id: order.body.id,
          reasonCode: 'dentro_de_zona_de_exclusao',
        }),
      ]);
    });

    it('caso B — o pedido órfão continua sendo reportado ao gerar a rota, nunca sumindo', async () => {
      const { app } = createApp();

      const order = await request(app)
        .post('/pedidos')
        .send({ location: { x: 3, y: 0 }, weightKg: 1, priority: 'alta' });
      await request(app).post('/zonas-exclusao').send({ center: { x: 3, y: 0 }, radiusKm: 1 });

      const routes = await request(app).get('/entregas/rota');

      expect(routes.body.trips).toEqual([]);
      expect(routes.body.unassignedOrders).toEqual([
        expect.objectContaining({
          id: order.body.id,
          reasonCode: 'dentro_de_zona_de_exclusao',
        }),
      ]);
    });

    it('caso B — o pedido volta a ser entregável se a zona for removida', async () => {
      const { app } = createApp();

      await request(app)
        .post('/pedidos')
        .send({ location: { x: 3, y: 0 }, weightKg: 1, priority: 'alta' });
      const zone = await request(app)
        .post('/zonas-exclusao')
        .send({ center: { x: 3, y: 0 }, radiusKm: 1 });

      await request(app).delete(`/zonas-exclusao/${zone.body.id}`);
      const routes = await request(app).get('/entregas/rota');

      expect(routes.body.unassignedOrders).toEqual([]);
      expect(routes.body.summary.totalDeliveries).toBe(1);
    });

    it('não reporta impacto quando a zona nova não afeta ninguém', async () => {
      const { app } = createApp();

      await request(app)
        .post('/pedidos')
        .send({ location: { x: 3, y: 0 }, weightKg: 1, priority: 'alta' });

      const zone = await request(app)
        .post('/zonas-exclusao')
        .send({ center: { x: -20, y: -20 }, radiusKm: 1 });

      expect(zone.body.affectedOrders).toEqual([]);
      expect(zone.body.warning).toBeUndefined();
    });

    it('avisa também quando a zona só encareceu a rota além do alcance', async () => {
      const { app } = createApp();

      // Alcance padrão 10km: (4.6, 0) dá 9.2km ida e volta, cabe justo.
      await request(app)
        .post('/pedidos')
        .send({ location: { x: 4.6, y: 0 }, weightKg: 1, priority: 'alta' });

      // Zona no meio do caminho: o desvio estoura o alcance.
      const zone = await request(app)
        .post('/zonas-exclusao')
        .send({ center: { x: 2.3, y: 0 }, radiusKm: 1.2 });

      expect(zone.body.affectedOrders).toHaveLength(1);
      expect(zone.body.affectedOrders[0].reasonCode).toBe('fora_de_alcance');
    });
  });

  it('rejeita pedido cujo endereço cai dentro de uma zona', async () => {
    const { app } = createApp();

    await request(app)
      .post('/zonas-exclusao')
      .send({ center: { x: 3, y: 0 }, radiusKm: 2, name: 'hospital' });

    const response = await request(app)
      .post('/pedidos')
      .send({ location: { x: 3, y: 0 }, weightKg: 1, priority: 'alta' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/hospital/);
  });

  it('aceita pedido atrás de uma zona (o drone contorna)', async () => {
    const { app } = createApp();

    await request(app).post('/zonas-exclusao').send({ center: { x: 2, y: 0 }, radiusKm: 1 });

    const response = await request(app)
      .post('/pedidos')
      .send({ location: { x: 4, y: 0 }, weightKg: 1, priority: 'alta' });

    expect(response.status).toBe(201);
  });

  it('a simulação reporta as viagens que precisaram desviar', async () => {
    const { app } = createApp();

    await request(app).post('/zonas-exclusao').send({ center: { x: 2, y: 0 }, radiusKm: 1 });
    await request(app)
      .post('/pedidos')
      .send({ location: { x: 4, y: 0 }, weightKg: 1, priority: 'alta' });

    const response = await request(app).get('/entregas/rota');

    expect(response.status).toBe(200);
    expect(response.body.noFlyZonesActive).toBe(1);
    expect(response.body.summary.tripsWithDetour).toBe(1);
    expect(response.body.trips[0].hasDetour).toBe(true);
  });

  it('desenha as zonas no mapa ASCII', async () => {
    const { app } = createApp();

    await request(app)
      .post('/zonas-exclusao')
      .send({ center: { x: 4, y: 0 }, radiusKm: 1.5, name: 'base-aerea' });
    await request(app)
      .post('/pedidos')
      .send({ location: { x: 8, y: 0 }, weightKg: 1, priority: 'alta' });

    const response = await request(app).get('/entregas/mapa');

    expect(response.text).toContain('#');
    expect(response.text).toContain('ZONAS DE EXCLUSÃO AÉREA');
    expect(response.text).toContain('base-aerea');
  });
});

describe('API rodando sobre SQLite', () => {
  // A API inteira precisa funcionar igual com qualquer driver de persistência.
  // `:memory:` usa a mesma engine e o mesmo SQL do arquivo real, sem tocar o disco.
  const sqlite = { driver: 'sqlite' as const, databaseFile: ':memory:' };

  it('cria pedido, gera rota e reporta entregas normalmente', async () => {
    const { app, close } = createApp(sqlite);

    await request(app)
      .post('/pedidos')
      .send({ location: { x: 1, y: 1 }, weightKg: 1, priority: 'alta' });
    await request(app)
      .post('/pedidos')
      .send({ location: { x: 2, y: 2 }, weightKg: 1, priority: 'media' });

    const response = await request(app).get('/entregas/rota');

    expect(response.status).toBe(200);
    expect(response.body.summary.totalDeliveries).toBe(2);

    close();
  });

  it('persiste zonas de exclusão e as aplica na alocação', async () => {
    const { app, close } = createApp(sqlite);

    await request(app)
      .post('/zonas-exclusao')
      .send({ center: { x: 3, y: 0 }, radiusKm: 1, name: 'aeroporto' });

    const blocked = await request(app)
      .post('/pedidos')
      .send({ location: { x: 3, y: 0 }, weightKg: 1, priority: 'alta' });

    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toMatch(/aeroporto/);

    close();
  });

  // Regressão: os drones eram gravados ANTES da simulação, então o banco
  // guardava bateria 100% e zero entregas — o voo não era registrado.
  it('grava o estado do drone DEPOIS do voo, não antes', async () => {
    const { app, close } = createApp(sqlite);

    await request(app)
      .post('/pedidos')
      .send({ location: { x: 3, y: 4 }, weightKg: 1, priority: 'alta' });
    await request(app).get('/entregas/rota');

    const drones = await request(app).get('/drones/status');

    expect(drones.body).toHaveLength(1);
    expect(drones.body[0].totalDeliveries).toBe(1);
    expect(drones.body[0].totalDistanceFlownKm).toBeCloseTo(10, 1);
    expect(drones.body[0].batteryPercent).toBeLessThan(100);

    close();
  });

  it('reflete no GET /pedidos o estado gravado após a simulação', async () => {
    const { app, close } = createApp(sqlite);

    await request(app)
      .post('/pedidos')
      .send({ location: { x: 1, y: 1 }, weightKg: 1, priority: 'alta' });
    await request(app).get('/entregas/rota');

    const orders = await request(app).get('/pedidos');

    expect(orders.body).toHaveLength(1);
    expect(orders.body[0].isDelivered).toBe(true);
    expect(orders.body[0].assignedDroneId).toBeTruthy();

    close();
  });
});

describe('CORS', () => {
  it('responde a uma preflight OPTIONS com 204 e os headers de CORS', async () => {
    const { app } = createApp();

    const response = await request(app).options('/pedidos');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });
});
