/*
 * TODO
 * - Use correct D3 types instead of `any`
 */

import * as d3 from 'd3'
import * as d3zoom from 'd3-zoom'
import {Subject} from 'rxjs'

import {getLogger} from '../../logger'
import {
  El,
  GraphNodeId,
  IDimensions,
  IGraphData,
  IGraphIndex,
  IGraphMetadata,
  IGraphNodeData,
} from '../../types'
import {
  BackgroundClickAction,
  BackgroundDblClickAction,
  GraphAction,
  NodeClickAction,
  NodeDblClickAction,
  NodeDragAction,
  NodeHoverEndAction,
  NodeHoverShortAction,
  NodeRightClickAction,
  ZoomAction,
} from './types'

const logger = getLogger('d3-graph')

interface ILinkTuple { source: GraphNodeId, target: GraphNodeId }

export default class GraphComponent {

  private static readonly _LABEL_FONT_SIZE = 8
  private static readonly _TRANSITION_DURATION = 250
  private static readonly _PAN_MOVEMENT_OFFSET = 50

  private static graphMetadataToList(metadata: IGraphMetadata): IGraphNodeData[] {
    return Object.keys(metadata)
      .map(Number)
      .map((k: GraphNodeId) => metadata[k])
  }

  private static flattenGraphIndex(index: IGraphIndex): ILinkTuple[] {
    const keys = Object.keys(index).map(Number)
    return keys.reduce(
      (accum: ILinkTuple[], source: GraphNodeId) => {
        accum.push(...index[source].map((target: GraphNodeId) => ({source, target})))
        return accum
      },
      [],
    )
  }

  private _width: number | null = null
  private _height: number | null = null
  // @ts-ignore // no unused variable
  private _host: El | null = null
  private _svg: any | null = null
  // @ts-ignore // no unused variable
  private _c10: any | null = null
  private _g: any | null = null
  private _zoomHandler: any| null = null

  private _links: any | null = null
  private _nodes: any | null = null
  private _drag: any | null = null
  private _nodeTextLabels: any| null = null

  // @ts-ignore // no unused variable
  private _selectedNode: any | null = null
  // @ts-ignore // no unused variable
  private _mouseDownNode: any | null = null

  private _actionStream: Subject<GraphAction> | null = null

  public constructor() {
    (document as any).d3Initialized = false
  }

  public init(
    host: El,
    dimensions: IDimensions,
    actionStream: Subject<GraphAction>,
  ): void {
    if ((document as any).d3Initialized
        && dimensions.height === this._height
        && dimensions.width === this._width) {
      logger.debug('Nothing changed, skipping init')
      return
    }

    if ((document as any).d3Initialized)
      if (this._svg !== null) {
        logger.debug('Removing existing svg element')
        this._svg.remove()
        this._svg = null
      } else {
        logger.debug('Can not remove svg, it has not been set')
      }

    (document as any).d3Initialized = true
    this._host = host

    // Used for node coloring
    this._c10 = d3.scaleOrdinal(d3.schemeCategory10)

    this._actionStream = actionStream

    this._svg = d3.select(host)
      .append('svg')
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .on('click', () => {
        d3.event.stopPropagation()
        this._actionStream!.next(new BackgroundClickAction())
      })
      .on('dblclick', () => {
        d3.event.stopPropagation()
        this._actionStream!.next(new BackgroundDblClickAction())
      })
    this._g = this._svg.append('g')
      .attr('class', 'everything')

    const zoomActions = () => {
      this._g.attr('transform', d3.event.transform)
    }
    this._zoomHandler = d3zoom.zoom()
      .on('zoom.a', zoomActions)
      .on('zoom.b', () => actionStream.next(new ZoomAction()))

    this._zoomHandler(this._svg)
  }

  public render(data: IGraphData): void {
    if (data === null) {
      logger.log('No data for rendering')
      return
    }

    logger.debug('Drawing graph nodes and links')

    // Must be called before renderNodes
    this._enableDrag()

    this._renderLinks(data)
    this._renderNodes(data)

    // this._enableClickToCenter()
    this._enableKeyboardPanning()
    this._enableNodeHighlightOnHover()
    this._disableDoubleClickZoom()
  }

  private _renderNodes(data: IGraphData): void {
    const metadataItems = GraphComponent.graphMetadataToList(data.metadata)

    const nodes = this._g.selectAll('.node')
      .data(metadataItems)
      .enter()
      .append('g')
      .attr('class', 'node')
      .on('click', (ev: Event) => {
        d3.event.stopPropagation()
        this._actionStream!.next(new NodeClickAction(ev))
      })
      .on('contextmenu', (ev: Event) => {
        d3.event.stopPropagation()
        this._actionStream!.next(new NodeRightClickAction(ev))
      })
      .on('dblclick', (ev: Event) => {
        d3.event.stopPropagation()
        this._actionStream!.next(new NodeDblClickAction(ev))
      })
      .on('mouseover.action', (d: any) => {
        d3.event.stopPropagation()
        this._actionStream!.next(new NodeHoverShortAction(d))
      })
      .on('mouseout.action', (d: any) => {
        d3.event.stopPropagation()
        this._actionStream!.next(new NodeHoverEndAction(d))
      })

    nodes
      .append('circle')
      .attr('cx', (d: IGraphNodeData) => d.x)
      .attr('cy', (d: IGraphNodeData) => d.y)
      .attr('r', 10)
      .attr('fill', () => 'white')
      .attr('stroke', 'black')
      .call(this._drag)

    nodes
      .append('text')
      .text((d: IGraphNodeData) => d.title)
      .attr('x', (d: IGraphNodeData) => d.x + GraphComponent._LABEL_FONT_SIZE / 2)
      .attr('y', (d: IGraphNodeData) => d.y + 15)
      .attr('font-size', GraphComponent._LABEL_FONT_SIZE)
      .attr('fill', 'black')
      .call(this._drag)

    this._nodes = this._g.selectAll('.node')
    this._nodeTextLabels = this._nodes.selectAll('text')
  }

  private _renderLinks(data: IGraphData): void {
    const linkData = GraphComponent.flattenGraphIndex(data.index)
    const metadataItems = GraphComponent.graphMetadataToList(data.metadata)

    this._links = this._g.selectAll('.link')
    this._links
      .data(linkData)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('x1', (l: any, i: number, refs: any[]) => {
        const sourceNode = metadataItems.filter((d: any) => d.id === l.source)[0]
        d3.select(refs[i]).attr('y1', sourceNode.y)
        return sourceNode.x
      })
      .attr('x2', (l: any, i: number, refs: any[]) => {
        const targetNode = metadataItems.filter((d: any) => d.id === l.target)[0]
        d3.select(refs[i]).attr('y2', targetNode.y)
        return targetNode.x
      })
      .attr('fill', 'none')
      .attr('stroke', 'black')
    this._links = this._g.selectAll('.link')
  }

  private _enableDrag(): void {
    this._drag = d3.drag()
    this._drag
      .on('drag', (d: any, i: number, refs: any[]) => {
        d.x += d3.event.dx
        d.y += d3.event.dy

        d3.select(refs[i])
          .attr('cx', d.x)
          .attr('cy', d.y)

        this._links.each((l: any, i_: number, refs_: any[]) => {
          if (l.source === d.id)
            d3.select(refs_[i_])
              .attr('x1', d.x)
              .attr('y1', d.y)
          else if (l.target === d.id)
            d3.select(refs_[i_])
              .attr('x2', d.x)
              .attr('y2', d.y)
        })

        if (this._nodeTextLabels === null)
          logger.warn(
            'enableDrag called before this._nodeTextLabels has been initialized')
        else
          this._nodeTextLabels.each((n: any, i_: number, refs_: any[]) => {
            if (n.id === d.id)
              d3.select(refs_[i_])
                .attr('x', d.x + GraphComponent._LABEL_FONT_SIZE / 2)
                .attr('y', d.y + 15)
          })

        this._nodes.each((n: any, i_: number, refs_: any[]) => {
          if (n.id === d.id)
            d3.select(refs_[i_]).select('circle')
              .attr('cx', d.x)
              .attr('cy', d.y)
        })

        this._actionStream!.next(new NodeDragAction(d))
      })
  }

  // @ts-ignore // no unused variable
  private _enableClickToCenter(): void {
    this._nodes.on('click', (d: any) => {
      const {translation, scale} = this._getGraphTranslationAndScale()
      const x = translation[0] - d.x
      const y = translation[1] - d.y
      this._g
        .transition()
        .duration(GraphComponent._TRANSITION_DURATION)
        .call(
          this._zoomHandler.transform,
          d3.zoomIdentity.translate(x, y).scale(scale),
        )
    })
  }

  private _enableKeyboardPanning(): void {
    const keymap = {
      LEFT: 37,
      UP: 38,
      RIGHT: 39,
      DOWN: 40,
    }

    d3.select('body')
      .on('keyup', () => {
        const {translation} = this._getGraphTranslationAndScale()
        let offsetRight = 0
        let offsetDown = 0

        switch (d3.event.keyCode) {
          case keymap.UP:
            offsetDown = translation[1] - GraphComponent._PAN_MOVEMENT_OFFSET
            break
          case keymap.DOWN:
            offsetDown = translation[1] + GraphComponent._PAN_MOVEMENT_OFFSET
            break
          case keymap.LEFT:
            offsetRight = translation[0] - GraphComponent._PAN_MOVEMENT_OFFSET
            break
          case keymap.RIGHT:
            offsetRight = translation[0] + GraphComponent._PAN_MOVEMENT_OFFSET
            break
          default:
            break
        }

        this._g
          .transition()
          .duration(GraphComponent._TRANSITION_DURATION)
          .call(
            this._zoomHandler.transform,
            d3.zoomIdentity.translate(offsetRight, offsetDown),
          )

        this._actionStream!.next(new ZoomAction())
      })
  }

  private _enableNodeHighlightOnHover(): void {
    this._nodes
      .on('mouseover', (d: any, i: number, refs: any[]) => {
        d3.select(refs[i])
          .style('stroke-width', '2px')
      })
      .on('mouseout', (d: any, i: number, refs: any[]) => {
        d3.select(refs[i])
          .style('stroke-width', '1px')
      })
  }

  private _disableDoubleClickZoom(): void {
    this._svg.on('dblclick.zoom', null)
  }

  private _getGraphTranslationAndScale(): {translation: number[], scale: number} {
    const transformRaw = this._g.attr('transform')
    if (transformRaw === null) return {translation: [0, 0], scale: 1}
    const [translationRaw, scaleRaw] = transformRaw.split(' ')
    const translation = translationRaw
      .replace('translate(', '')
      .replace(')', '')
      .split(',')
      .map(Number)
    const scale = Number(scaleRaw.match(/\d(\.\d+)*/)[0])
    return {translation, scale}
  }

}