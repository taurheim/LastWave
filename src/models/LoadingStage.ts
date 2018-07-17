export default class LoadingStage {
  constructor(
    // Displayed to the user during this stage
    public stageName: string,
    // How much (out of 100) of the loading bar should this stage take up?
    public stageWeight: number, 
    // How many segments can this stage be split into?
    public stageSegments: number = 0,
    // What segment are we on right now?
    public currentSegment: number = 0,
  ) {
  }
}
