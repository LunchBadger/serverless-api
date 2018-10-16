using System;
using Kubeless.Functions;

public class handler
{
    public string FN_NAME(Event k8Event, Context k8Context)
    {
        return "Express Serverless Platform .NET Core 2.0 function";
    }
}