# remapper.py
import numpy as np

class PiecewiseLinearRemapper:
    def __init__(self, anchors):
        self.anchors = sorted(anchors, key=lambda x: x[0])
        self.raw_pts    = np.array([a[0] for a in self.anchors])
        self.target_pts = np.array([a[1] for a in self.anchors])

    def transform(self, raw: float) -> float:
        return float(np.interp(raw, self.raw_pts, self.target_pts))

    def transform_array(self, arr):
        return np.interp(arr, self.raw_pts, self.target_pts)