import * as html from '@hyperapp/html'
import {Subject} from 'rxjs'

import * as Editor from '@components/editor/editor-component'
import GraphView from '@components/graph/graph-view-component'
import {
  FocusCommand,
  GraphAction,
  GraphCommand,
  ResetGraphCommand,
} from '@components/graph/types'
import * as Toolbar from '@components/toolbar/toolbar-component'
import Empty from '@components/widgets/empty'
import {getLogger} from '@lib/logger'
import search from '@lib/search'
import {
  El,
  GraphNodeId,
  IGraphIndex,
  IGraphMetadata,
  IGraphNodeData,
  NoteDataType,
} from '@lib/types'
import {emptyFunction} from '@lib/utils'
import {actions as graphActions} from './actions/graph'

import './app.css'

const logger = getLogger('main')

const graphActionStream = new Subject<GraphAction>()
const graphCommandStream = new Subject<GraphCommand>()
const graphCommandObservable = graphCommandStream.asObservable()
const editorOpenChange = new Subject<void>()
const editorOpenChangeObservable = editorOpenChange.asObservable()

const EDITOR_OPEN_CHANGE_OBSERVABLE_DELAY = 250

interface IState {
  graph: IGraphState
  editor: any
  settings: any
  runtime: IRuntime
  toolbar: any
}

interface IGraphState {
  index: IGraphIndex
  metadata: IGraphMetadata
  height: number
  width: number
}

interface IRuntime {
  showEditor: boolean
  selectedNode: null | GraphNodeId,
}

export const initialState: IState = {
  toolbar: Toolbar.state,
  editor: Editor.state,
  graph: {
    index: {},
    metadata: {},
    height: 0,
    width: 0,
  },
  settings: {},
  runtime: {
    showEditor: true,
    selectedNode: null,
  },
}

export const appActions = {
  graph: graphActions,
  editor: Editor.actions,
  toolbar: Toolbar.actions,

  onCreate: (el: El) => (state: IState, actions: any) => {
    logger.debug('element created (app)', el)

    actions.graph.init()
    actions.graph.handleGraphActions({
      actionStream: graphActionStream,
      selectNode: actions.selectNode,
    })
  },

  save: () => (_: IState, actions: any) => {
    logger.log('Saving application data')
    return actions.graph.save()
  },

  selectNode: (nodeId: GraphNodeId) => (state: IState) => {
    setTimeout(() => editorOpenChange.next(), EDITOR_OPEN_CHANGE_OBSERVABLE_DELAY)
    return {
      runtime: {
        ...state.runtime,
        showEditor: true,
        selectedNode: nodeId,
      },
    }
  },

  onEditorClose: () => (state: IState) => {
    setTimeout(() => editorOpenChange.next(), EDITOR_OPEN_CHANGE_OBSERVABLE_DELAY)
    return {
      runtime: {
        ...state.runtime,
        showEditor: false,
      },
    }
  },

  onSearchResultClick: (node: IGraphNodeData) => {
    graphCommandStream.next(new FocusCommand({x: node.x, y: node.y}))
  },

  resetGraph: () => {
    graphCommandStream.next(new ResetGraphCommand())
  },
}

export function view(state: IState, actions: any) {
  return html.div(
    {
      id: 'app',
      oncreate: (el: El) => actions.onCreate(el),
    },
    [
      Toolbar.view(
        state.toolbar,
        actions.toolbar,
        {
          onBack: emptyFunction,
          onHome: actions.resetGraph,
          onSave: actions.save,
          onSettings: emptyFunction,
          onSearchResultClick: actions.onSearchResultClick,
        },
        (query: string) => search(state.graph.metadata, query),
      ),
      GraphView(
        {height: state.graph.height, width: state.graph.width},
        actions.onGraphReset,
        {index: state.graph.index, metadata: state.graph.metadata},
        graphActionStream,
        actions.graph.resizeGraph,
        editorOpenChangeObservable,
        graphCommandObservable,
      ),
      (state.runtime.showEditor && state.runtime.selectedNode !== null)
        ? Editor.view(
          state.editor,
          actions.editor,
          state.graph.metadata[state.runtime.selectedNode],
          actions.onEditorClose,
        )
        : Empty(),
    ],
  )
}
