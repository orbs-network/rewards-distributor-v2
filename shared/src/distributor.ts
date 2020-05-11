import { EventHistory } from './history';
import { Split, Division, Calculator } from './calculator';

export class Distribution {
  // returns the in-progress distribution if exists, null if no distribution in progress
  static getInProgress(currentBlock: number, history: EventHistory): Distribution | null {
    return null;
  }

  // starts a new distribution assuming there is none in progress and returns it
  static startNew(currentBlock: number, split: Split, history: EventHistory): Distribution {
    const inProgress = Distribution.getInProgress(currentBlock, history);
    if (inProgress != null) {
      throw new Error(`There already is a distribution in progress.`);
    }
    return new Distribution(0, 0, split, history);
  }

  public division: Division;

  private constructor(
    public firstBlock: number,
    public lastBlock: number,
    public split: Split,
    private history: EventHistory
  ) {
    this.division = Calculator.divideBlockPeriod(firstBlock, lastBlock, split, history);
  }

  // returns true if more transactions need to be sent, false if distribution is finished
  async sendNextTransaction(): Promise<boolean> {
    return false;
  }
}
