import math
import unittest
from trader.strategy import Candle
from trader.indicator_evolution import evolve_indicators, replay, IndicatorGenome


class IndicatorEvolutionTests(unittest.TestCase):
    def candles(self,n=220):
        prices=[100+i*.06+3*math.sin(i/6) for i in range(n)]
        return [Candle(p,p*1.01,p*.99,100) for p in prices]

    def test_eight_generations_and_indicator_genome(self):
        result=evolve_indicators({"SYNTHUSDT":self.candles()},bots=8,generations=8,seed=9)
        self.assertEqual(len(result["generations"]),8)
        self.assertIn("rsi_buy_max",result["winner"])
        self.assertIn("max_atr_percent",result["winner"])
        self.assertIn("SYNTHUSDT",result["out_of_sample"])
        self.assertEqual(result["mode"],"PAPER_ONLY")

    def test_deterministic(self):
        data={"SYNTHUSDT":self.candles()}
        self.assertEqual(evolve_indicators(data,bots=4,generations=2,seed=1),
                         evolve_indicators(data,bots=4,generations=2,seed=1))

    def test_winner_never_worse_than_best_evaluated_generation(self):
        from trader.indicator_evolution import replay, IndicatorGenome
        candles=self.candles()
        result=evolve_indicators({"SYNTHUSDT":candles},bots=8,generations=5,seed=9)
        genome=IndicatorGenome(**result["winner"])
        training=candles[:int(len(candles)*.7)]
        performance=replay(training,genome)
        winner_score=performance["equity"]-100*performance["drawdown"]-10*int(performance["dead"])
        self.assertGreaterEqual(winner_score+0.0001,
                                max(g["best_train_score"] for g in result["generations"]))

    def test_walk_forward_has_three_ordered_disjoint_windows(self):
        candles=self.candles(240)
        result=evolve_indicators({"SYNTHUSDT":candles},bots=4,generations=2,seed=7)
        windows=result["walk_forward"]["SYNTHUSDT"]
        self.assertEqual(len(windows),3)
        self.assertEqual(windows[0]["start_index"],168)
        self.assertEqual(windows[-1]["end_index_exclusive"],240)
        for left,right in zip(windows,windows[1:]):
            self.assertEqual(left["end_index_exclusive"],right["start_index"])
        self.assertEqual(result["approved_for_paper"],
                         (result["out_of_sample"]["SYNTHUSDT"]["trades"]>0
                          and not result["out_of_sample"]["SYNTHUSDT"]["dead"]
                          and result["out_of_sample"]["SYNTHUSDT"]["equity"]>=100
                          and sum(w["trades"]>0 for w in windows)>=2
                          and all(not w["dead"] for w in windows)
                          and sum(w["equity"]>=100 for w in windows)>=2))

    def test_short_history_rejected(self):
        with self.assertRaises(ValueError):
            evolve_indicators({"SYNTHUSDT":self.candles(90)},bots=4,generations=2)
