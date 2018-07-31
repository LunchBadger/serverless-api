package kubeless

import (
	"github.com/kubeless/kubeless/pkg/functions"
)

func Handler(event functions.Event, context functions.Context) (string, error) {
	return "LunchBadger Go 1.10 function", nil
}
