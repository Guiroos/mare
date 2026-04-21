import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { categoryGroups, categories } from '@/lib/db/schema';

type GroupSeed = {
  name: string;
  sortOrder: number;
  categories: { name: string; defaultBudget: string | null }[];
};

const DEFAULT_GROUPS: GroupSeed[] = [
  {
    name: 'Essencial',
    sortOrder: 0,
    categories: [
      { name: 'Mercado', defaultBudget: '350.00' },
      { name: 'Saúde', defaultBudget: '300.00' },
      { name: 'Uber/transporte', defaultBudget: '200.00' },
      { name: 'Pets', defaultBudget: '200.00' },
      { name: 'Aluguel', defaultBudget: null },
      { name: 'Contas', defaultBudget: '1000.00' },
      { name: 'Necessidades', defaultBudget: '100.00' },
      { name: 'Desenvolvimento', defaultBudget: null },
    ],
  },
  {
    name: 'Estilo de Vida',
    sortOrder: 1,
    categories: [
      { name: 'IFood/restaurante', defaultBudget: '400.00' },
      { name: 'Eletrônicos', defaultBudget: '300.00' },
      { name: 'Lazer', defaultBudget: '700.00' },
      { name: 'Presentes', defaultBudget: '300.00' },
      { name: 'Beleza', defaultBudget: '100.00' },
      { name: 'Assinaturas', defaultBudget: '300.00' },
      { name: 'Jogos', defaultBudget: '150.00' },
      { name: 'Roupa', defaultBudget: '200.00' },
      { name: 'Despesas eventuais', defaultBudget: '200.00' },
    ],
  },
];

export async function seedDefaultCategories(userId: string) {
  const existing = await db
    .select({ id: categoryGroups.id })
    .from(categoryGroups)
    .where(eq(categoryGroups.userId, userId))
    .limit(1);

  if (existing.length > 0) return;

  for (const group of DEFAULT_GROUPS) {
    const [inserted] = await db
      .insert(categoryGroups)
      .values({ userId, name: group.name, sortOrder: group.sortOrder })
      .returning({ id: categoryGroups.id });

    if (!inserted) continue;

    await db.insert(categories).values(
      group.categories.map((cat) => ({
        userId,
        groupId: inserted.id,
        name: cat.name,
        defaultBudget: cat.defaultBudget,
      }))
    );
  }
}
