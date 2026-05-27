import { makeNeonTesting } from 'neon-testing'

export const neonTestingSetup = makeNeonTesting({
  apiKey: process.env.NEON_API_KEY!,
  projectId: process.env.NEON_PROJECT_ID!,
  parentBranchId: process.env.NEON_PARENT_BRANCH_ID!,
  autoCloseWebSockets: true,
})
