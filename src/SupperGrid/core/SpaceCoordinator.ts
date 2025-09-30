import type { SpaceRegistry } from "./Registries";
import type { SpaceId, Space } from "./types";
import { v4 as uuidv4 } from 'uuid';

export class SpaceCoordinator {
  private registry: SpaceRegistry;

  constructor(registry: SpaceRegistry) {
    this.registry = registry;
  }

  // Link two spaces vertically: top <-> bottom
  linkVertical(topId: SpaceId, bottomId: SpaceId): void {
    const topSpace = this.registry.get(topId);
    const bottomSpace = this.registry.get(bottomId);
    if (!topSpace || !bottomSpace) return;

    topSpace.bottom = bottomId;
    bottomSpace.top = topId;

    this.registry.register(topId, topSpace);
    this.registry.register(bottomId, bottomSpace);
  }

  // Create a new space for a plugin and link it to the bottom of the chain
  createPluginSpace(pluginName: string): SpaceId {
    const spaceId = uuidv4(); // Use UUID as space ID
    
    const newSpace: Space = {
      name: `${pluginName} Space`,
      owner: pluginName,
      top: null,
      bottom: null,
      rowIds: [] // Initialize empty rowIds array
    };

    // Find the bottom-most space
    const allSpaces = this.registry.list();
    let bottomSpaceId: SpaceId | null = null;
    
    for (const id of allSpaces) {
      const space = this.registry.get(id);
      if (space && !space.bottom) {
        bottomSpaceId = id;
        break;
      }
    }

    // Register the new space
    this.registry.register(spaceId, newSpace);

    // Link to bottom if there's an existing bottom space
    if (bottomSpaceId) {
      this.linkVertical(bottomSpaceId, spaceId);
    }

    return spaceId;
  }

  // Get the space above this one
  getSpaceAbove(spaceId: SpaceId): SpaceId | null {
    const space = this.registry.get(spaceId);
    return space?.top || null;
  }

  // Get the space below this one
  getSpaceBelow(spaceId: SpaceId): SpaceId | null {
    const space = this.registry.get(spaceId);
    return space?.bottom || null;
  }

  // Link the last plugin space to the table space
  linkLastPluginSpaceToTableSpace(tableSpaceId: SpaceId): void {
    // Find the bottom-most plugin space (space with no bottom that is not table space)
    const allSpaces = this.registry.list();
    let lastPluginSpaceId: SpaceId | null = null;
    
    for (const id of allSpaces) {
      const space = this.registry.get(id);
      if (space && !space.bottom && id !== tableSpaceId && space.owner !== 'table') {
        lastPluginSpaceId = id;
        break;
      }
    }

    // Link the last plugin space to table space
    if (lastPluginSpaceId) {
      this.linkVertical(lastPluginSpaceId, tableSpaceId);
    }
  }
}