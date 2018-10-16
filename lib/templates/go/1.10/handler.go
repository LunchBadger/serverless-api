package kubeless

import (
	"github.com/kubeless/kubeless/pkg/functions"
)

func Handler(event functions.Event, context functions.Context) (string, error) {
	return "Express Serverless Platform Go 1.10 function", nil
}
