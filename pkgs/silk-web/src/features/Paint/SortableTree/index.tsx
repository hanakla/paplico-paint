import {
  closestCenter,
  DndContext,
  MeasuringStrategy,
  useSensors,
} from '@dnd-kit/core'

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
}

export const SortableTree = () => {
  return (
    <DndContext
      collisionDetection={closestCenter}
      measuring={measuring}
      onDragStart={}
    ></DndContext>
  )
}
