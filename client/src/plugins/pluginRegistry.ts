import type { DAWPlugin, PluginRegistry } from './plugin.types'

class PluginRegistryImpl implements PluginRegistry {
  private readonly plugins = new Map<string, DAWPlugin>()

  register(plugin: DAWPlugin): void {
    this.plugins.set(plugin.id, plugin)
  }

  unregister(id: string): void {
    this.plugins.delete(id)
  }

  get(id: string): DAWPlugin | undefined {
    return this.plugins.get(id)
  }

  getAll(): DAWPlugin[] {
    return Array.from(this.plugins.values())
  }
}

export const pluginRegistry: PluginRegistry = new PluginRegistryImpl()
