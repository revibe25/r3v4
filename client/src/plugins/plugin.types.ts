export interface DAWPlugin {
  id:      string
  name:    string
  version: string
  initialize(): Promise<void>
  destroy():    Promise<void>
}

export interface PluginRegistry {
  register(plugin: DAWPlugin):   void
  unregister(id: string):        void
  get(id: string):               DAWPlugin | undefined
  getAll():                      DAWPlugin[]
}
