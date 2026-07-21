export function squirrelEventAction(argument) {
  switch (argument) {
    case '--squirrel-install':
    case '--squirrel-updated':
      return 'create-shortcut';
    case '--squirrel-uninstall':
      return 'remove-shortcut';
    case '--squirrel-obsolete':
      return 'quit';
    default:
      return 'launch';
  }
}
