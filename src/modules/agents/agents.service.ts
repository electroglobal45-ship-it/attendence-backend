import * as fs from 'fs/promises'
import * as path from 'path'

export interface AgentInfo {
  id: string
  model: string
  provider: string
  specializations: string[]
  capabilities: {
    maxTokens: number
    supportedLanguages: string[]
    tools: string[]
    [key: string]: any
  }
  priority: number
  enabled: boolean
  stats?: {
    totalTasks: number
    successRate: number
    avgDuration: number
    skillsLearned: number
  }
}

export class AgentsService {
  private getConfigPath(): string {
    // Try process.cwd() / ../agents/config/agent-config.json (when running in backend dir)
    // or process.cwd() / agents/config/agent-config.json (when running in workspace root)
    const possiblePaths = [
      path.join(process.cwd(), '../agents/config/agent-config.json'),
      path.join(process.cwd(), 'agents/config/agent-config.json'),
      path.join(__dirname, '../../../../agents/config/agent-config.json')
    ]
    
    // We will return the first path, but in operations we will check if it exists
    return possiblePaths[0]
  }

  private getHistoryPath(): string {
    return path.join(path.dirname(this.getConfigPath()), '../memory/task-history.json')
  }

  private getSkillsDir(): string {
    return path.join(path.dirname(this.getConfigPath()), '../skills')
  }

  private async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content) as T
    } catch (error) {
      // Return null if file not found or malformed
      return null
    }
  }

  private async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  // Fallback default stats if task-history.json doesn't exist
  private getDefaultStats(agentId: string) {
    const defaults: Record<string, { totalTasks: number; successRate: number; avgDuration: number; skillsLearned: number }> = {
      'claude-agent': { totalTasks: 45, successRate: 0.95, avgDuration: 234, skillsLearned: 12 },
      'gpt-agent': { totalTasks: 67, successRate: 0.92, avgDuration: 189, skillsLearned: 18 },
      'gemini-agent': { totalTasks: 38, successRate: 0.97, avgDuration: 156, skillsLearned: 15 }
    }
    return defaults[agentId] || { totalTasks: 0, successRate: 0, avgDuration: 0, skillsLearned: 0 }
  }

  async getAgents(): Promise<AgentInfo[]> {
    const configPath = this.getConfigPath()
    let configData = await this.readJsonFile<{ agents: Record<string, any> }>(configPath)
    
    // If we failed to find it with path[0], try path[1]
    if (!configData) {
      const altPath = path.join(process.cwd(), 'agents/config/agent-config.json')
      configData = await this.readJsonFile<{ agents: Record<string, any> }>(altPath)
    }

    if (!configData || !configData.agents) {
      throw new Error('Agent configuration file not found or invalid.')
    }

    // Attempt to read stats from memory history
    const historyPath = this.getHistoryPath()
    const history = await this.readJsonFile<any[]>(historyPath)

    // Count learned skill files
    let skillsCount: Record<string, number> = {}
    try {
      const skillsDir = this.getSkillsDir()
      const files = await fs.readdir(skillsDir)
      const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md')
      
      mdFiles.forEach(file => {
        const parts = file.split('-')
        const agent = parts[0] // e.g. 'claude' or 'gpt'
        if (agent) {
          skillsCount[agent] = (skillsCount[agent] || 0) + 1
        }
      })
    } catch {
      // Directory may not exist yet
    }

    const agentsList: AgentInfo[] = []

    for (const [key, agent] of Object.entries(configData.agents)) {
      const agentId = agent.id || `${key}-agent`
      
      // Calculate stats based on history if available, else fallback to defaults
      let stats = this.getDefaultStats(agentId)
      
      if (history && Array.isArray(history)) {
        const agentTasks = history.filter(item => item.result?.agent === agentId)
        if (agentTasks.length > 0) {
          const totalTasks = agentTasks.length
          const successfulTasks = agentTasks.filter(item => item.success).length
          const successRate = totalTasks > 0 ? parseFloat((successfulTasks / totalTasks).toFixed(2)) : 0
          const avgDuration = Math.round(agentTasks.reduce((sum, item) => sum + (item.duration || 0), 0) / totalTasks)
          
          stats = {
            totalTasks,
            successRate,
            avgDuration,
            skillsLearned: skillsCount[key] || stats.skillsLearned // use dir count if exists, otherwise fallback
          }
        }
      }

      agentsList.push({
        id: agentId,
        model: agent.model,
        provider: agent.provider,
        specializations: agent.specializations || [],
        capabilities: agent.capabilities || { maxTokens: 0, supportedLanguages: [], tools: [] },
        priority: agent.priority !== undefined ? agent.priority : 1,
        enabled: agent.enabled !== undefined ? agent.enabled : true,
        stats
      })
    }

    return agentsList
  }

  async toggleAgent(agentId: string, enabled: boolean): Promise<AgentInfo[]> {
    let configPath = this.getConfigPath()
    let configData = await this.readJsonFile<any>(configPath)

    if (!configData) {
      configPath = path.join(process.cwd(), 'agents/config/agent-config.json')
      configData = await this.readJsonFile<any>(configPath)
    }

    if (!configData || !configData.agents) {
      throw new Error('Agent configuration file not found or invalid.')
    }

    // Find agent by ID (e.g. key is 'claude', agentId is 'claude-agent')
    let foundKey: string | null = null
    for (const [key, agent] of Object.entries(configData.agents)) {
      const id = (agent as any).id || `${key}-agent`
      if (id === agentId) {
        foundKey = key
        break
      }
    }

    if (!foundKey) {
      throw new Error(`Agent with ID ${agentId} not found.`)
    }

    configData.agents[foundKey].enabled = enabled
    await this.writeJsonFile(configPath, configData)

    return this.getAgents()
  }

  async updatePriority(agentId: string, priority: number): Promise<AgentInfo[]> {
    let configPath = this.getConfigPath()
    let configData = await this.readJsonFile<any>(configPath)

    if (!configData) {
      configPath = path.join(process.cwd(), 'agents/config/agent-config.json')
      configData = await this.readJsonFile<any>(configPath)
    }

    if (!configData || !configData.agents) {
      throw new Error('Agent configuration file not found or invalid.')
    }

    let foundKey: string | null = null
    for (const [key, agent] of Object.entries(configData.agents)) {
      const id = (agent as any).id || `${key}-agent`
      if (id === agentId) {
        foundKey = key
        break
      }
    }

    if (!foundKey) {
      throw new Error(`Agent with ID ${agentId} not found.`)
    }

    configData.agents[foundKey].priority = Number(priority)
    await this.writeJsonFile(configPath, configData)

    return this.getAgents()
  }
}
