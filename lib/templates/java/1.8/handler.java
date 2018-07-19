package io.kubeless;

import io.kubeless.Event;
import io.kubeless.Context;

public class handler {
    public String FN_NAME(io.kubeless.Event event, io.kubeless.Context context) {
        System.out.println(event.Data);
        return event.Data;
    }
}