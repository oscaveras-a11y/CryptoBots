import unittest
import torch
from moe import Config,JarvisMoE,parameter_count,seven_billion_blueprint

class MoETests(unittest.TestCase):
    def test_forward_and_gradient(self):
        model=JarvisMoE(Config(width=32,layers=1,heads=4,experts=4,active_experts=1,ff_width=64,context=16))
        output,balance=model(torch.randint(0,256,(2,8)))
        self.assertEqual(tuple(output.shape),(2,8,256))
        (output.mean()+0.01*balance).backward()
        self.assertIsNotNone(model.blocks[0].moe.router.weight.grad)
    def test_configuration_validation(self):
        with self.assertRaises(ValueError):
            JarvisMoE(Config(width=31,heads=4))
    def test_target_is_not_prototype(self):
        model=JarvisMoE()
        self.assertLess(parameter_count(model),7_000_000_000)
        self.assertEqual(seven_billion_blueprint()['target_parameters'],7_000_000_000)

if __name__=='__main__':
    unittest.main()
