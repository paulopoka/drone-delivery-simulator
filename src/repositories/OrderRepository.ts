import { Order } from '../domain/Order';

/**
 * Contrato de persistência de pedidos.
 *
 * Deliberadamente **síncrono**: as implementações existentes (memória e
 * SQLite) são síncronas, e manter a interface assim evita espalhar
 * `async/await` por toda a camada HTTP sem ganho real. Trocar por um banco
 * remoto (Postgres, Mongo) exigiria tornar este contrato assíncrono — é o
 * custo conhecido dessa escolha, e está documentado no README.
 */
export interface OrderRepository {
  save(order: Order): Order;
  findAll(): Order[];
  /** Pedidos ainda não entregues e ainda não alocados a nenhum drone. */
  findPending(): Order[];
  findById(id: string): Order | undefined;
  clear(): void;
}
