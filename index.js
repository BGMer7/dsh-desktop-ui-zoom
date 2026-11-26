/**
 * Host side of the plugin: deliberately empty.
 *
 * The whole plugin is a client-side stylesheet plus three fixed shortcuts.
 * The loader still needs a host entry so the package can be registered and
 * its client bundle served, so this module only declares the plugin.
 */
export const name = 'dsh-desktop-ui-zoom'

export function apply() {
  /* no host behaviour */
}
