import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { categoryGroups, categories } from '@/lib/db/schema'

type GroupSeed = {
  name: string
  sortOrder: number
  categories: { name: string; defaultBudget: string | null; color: string; bgColor: string }[]
}

const DEFAULT_GROUPS: GroupSeed[] = [
  {
    name: 'Essencial',
    sortOrder: 0,
    categories: [
      { name: 'Mercado', defaultBudget: '350.00', color: '#2d6e3e', bgColor: '#e8f5ec' },
      { name: 'Saúde', defaultBudget: '300.00', color: '#1a6b5e', bgColor: '#e4f2f0' },
      { name: 'Uber/transporte', defaultBudget: '200.00', color: '#7a5c00', bgColor: '#fdf6e0' },
      { name: 'Pets', defaultBudget: '200.00', color: '#7a4200', bgColor: '#fdf0e4' },
      { name: 'Aluguel', defaultBudget: null, color: '#2e4a7a', bgColor: '#e8eef6' },
      { name: 'Contas', defaultBudget: '1000.00', color: '#4d2e8a', bgColor: '#ece8f5' },
      { name: 'Necessidades', defaultBudget: '100.00', color: '#5c4a1a', bgColor: '#f4f0e6' },
      { name: 'Desenvolvimento', defaultBudget: null, color: '#2e3e8a', bgColor: '#e8eaf5' },
    ],
  },
  {
    name: 'Estilo de Vida',
    sortOrder: 1,
    categories: [
      { name: 'IFood/restaurante', defaultBudget: '400.00', color: '#9e2e1e', bgColor: '#fde8e6' },
      { name: 'Eletrônicos', defaultBudget: '300.00', color: '#1e3e7a', bgColor: '#e6eef6' },
      { name: 'Lazer', defaultBudget: '700.00', color: '#8a1e8a', bgColor: '#f6e4f6' },
      { name: 'Presentes', defaultBudget: '300.00', color: '#8a1a4a', bgColor: '#f6e4ec' },
      { name: 'Beleza', defaultBudget: '100.00', color: '#5e2a8a', bgColor: '#f2e6f6' },
      { name: 'Assinaturas', defaultBudget: '300.00', color: '#0e4e5e', bgColor: '#e4f0f4' },
      { name: 'Jogos', defaultBudget: '150.00', color: '#4a1a8e', bgColor: '#ece6f8' },
      { name: 'Roupa', defaultBudget: '200.00', color: '#8a2a2a', bgColor: '#f6e8e8' },
      { name: 'Despesas eventuais', defaultBudget: '200.00', color: '#363e50', bgColor: '#eaecf0' },
    ],
  },
]

export async function seedDefaultCategories(userId: string) {
  const existing = await db
    .select({ id: categoryGroups.id })
    .from(categoryGroups)
    .where(eq(categoryGroups.userId, userId))
    .limit(1)

  if (existing.length > 0) return

  for (const group of DEFAULT_GROUPS) {
    const [inserted] = await db
      .insert(categoryGroups)
      .values({ userId, name: group.name, sortOrder: group.sortOrder })
      .returning({ id: categoryGroups.id })

    if (!inserted) continue

    await db.insert(categories).values(
      group.categories.map((cat) => ({
        userId,
        groupId: inserted.id,
        name: cat.name,
        defaultBudget: cat.defaultBudget,
        color: cat.color,
        bgColor: cat.bgColor,
      }))
    )
  }
}
