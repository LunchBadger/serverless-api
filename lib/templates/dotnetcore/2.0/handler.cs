using System;
using Kubeless.Functions;

public class module
{
    public string FN_NAME(Event k8Event, Context k8Context)
    {
        return "LunchBadger .NET Core 2.0 function";
    }
}